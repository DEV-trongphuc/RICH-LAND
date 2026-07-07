import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { fetchAPI } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useUIStore } from '../store/uiStore';
import { Building2, Users, FileText, Plus, Trash2, Edit, X, Upload, Download, Check, AlertCircle, Layers } from 'lucide-react';
import { EmptyCard } from '../components/ui/EmptyCard';
import { compressToWebP } from '../utils/imageCompress';
import { CustomSelect } from '../components/ui/CustomSelect';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { AddressSelect } from '../components/ui/AddressSelect';



interface Project {
  id: number;
  name: string;
  code: string;
  description: string;
  status: string;
  developer?: string;
  location?: string;
  created_at: string;
  roster_count?: number;
  doc_count?: number;
  document_ids?: string;
  campaign_ids?: string;
  progress_percent?: number;
  construction_status?: string;
  legal_status?: string;
  scale_block_count?: number;
  scale_unit_count?: number;
  handover_year?: number;
  folder_path?: string;
  manager_ids?: string;
}

interface RosterMember {
  id: number;
  full_name: string;
  email: string;
  role: string;
  is_assigned: number;
}

interface ProjectDoc {
  id: number;
  name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_by_name: string;
  created_at: string;
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const { addToast, showConfirm } = useUIStore();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [developers, setDevelopers] = useState<any[]>([]);
  const [allFiles, setAllFiles] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [projectModalMode, setProjectModalMode] = useState<'view' | 'edit' | 'create'>('view');
  const [campaignModalMode, setCampaignModalMode] = useState<'view' | 'edit' | 'create'>('view');

  const formatFileName = (name: string, maxLen: number = 30) => {
    if (!name || name.length <= maxLen) return name;
    const extIndex = name.lastIndexOf('.');
    const ext = extIndex !== -1 ? name.substring(extIndex) : '';
    const baseName = extIndex !== -1 ? name.substring(0, extIndex) : name;
    const cutLen = maxLen - ext.length - 3;
    if (cutLen <= 0) return name.substring(0, maxLen) + '...';
    return baseName.substring(0, cutLen) + '...' + ext;
  };
  const [activeSubTab, setActiveSubTab] = useState<'projects' | 'campaigns'>('projects');
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'campaigns') {
      setActiveSubTab('campaigns');
    } else {
      setActiveSubTab('projects');
    }
  }, [window.location.search]);

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Partial<Project> | null>(null);
  const [autoCode, setAutoCode] = useState(true);

  const generateCodeFromName = (name: string) => {
    if (!name) return '';
    const cleanName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const words = cleanName.trim().split(/\s+/);
    const initials = words
      .map(w => w.charAt(0))
      .filter(char => /[a-zA-Z0-9]/.test(char))
      .join('')
      .toUpperCase();
    return initials;
  };

  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [rosterMembers, setRosterMembers] = useState<RosterMember[]>([]);

  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
  const [projectDocs, setProjectDocs] = useState<ProjectDoc[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const isAdmin = user && ['admin', 'superadmin', 'super_admin', 'manager', 'director'].includes(user.role);

  const parseIds = (val: any): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(String);
    if (typeof val === 'string') {
      if (val.startsWith('[')) {
        try {
          return JSON.parse(val).map(String);
        } catch (e) {}
      }
      return val.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
  };

  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await fetchAPI('projects');
      if (res.success) {
        setProjects(res.data || []);
      } else {
        addToast(res.message || 'Lỗi tải danh sách dự án', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadDevelopers = async () => {
    try {
      const res = await fetchAPI('suppliers?limit=100');
      if (res.success) {
        setDevelopers(res.data?.items || res.data || []);
      }
    } catch (e) {
      console.error('Failed to load developers', e);
    }
  };

  const loadAllFiles = async () => {
    try {
      const res = await fetchAPI('cloud-files?limit=100');
      if (res.success) {
        setAllFiles(res.data?.items || res.data || []);
      }
    } catch (e) {
      console.error('Failed to load all files', e);
    }
  };

  const loadCampaigns = async () => {
    setCampaignsLoading(true);
    try {
      const res = await fetchAPI('campaigns');
      if (res.success) {
        setCampaigns(res.data || []);
      }
    } catch (e) {
      console.error('Failed to load campaigns', e);
    } finally {
      setCampaignsLoading(false);
    }
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaign?.name) {
      addToast('Tên chiến dịch là bắt buộc', 'error');
      return;
    }

    try {
      const isNew = !editingCampaign.id;
      const action = isNew ? 'campaigns' : `campaigns/${editingCampaign.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetchAPI(action, {
        method,
        body: JSON.stringify(editingCampaign)
      });

      if (res.success) {
        addToast(isNew ? 'Tạo chiến dịch thành công!' : 'Cập nhật chiến dịch thành công!', 'success');
        setIsCampaignModalOpen(false);
        loadCampaigns();
      } else {
        addToast(res.message || 'Lỗi lưu thông tin chiến dịch', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Lỗi kết nối', 'error');
    }
  };

  const handleDeleteCampaign = (id: number) => {
    showConfirm({
      title: 'Xóa chiến dịch',
      message: 'Bạn có chắc chắn muốn xóa chiến dịch này không? Hành động này không thể hoàn tác.',
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await fetchAPI(`campaigns/${id}`, { method: 'DELETE' });
          if (res.success) {
            addToast('Xóa chiến dịch thành công!', 'success');
            loadCampaigns();
          } else {
            addToast(res.message || 'Lỗi khi xóa chiến dịch', 'error');
          }
        } catch (err: any) {
          addToast(err.message || 'Lỗi kết nối', 'error');
        }
      }
    });
  };

  const loadUsers = async () => {
    try {
      const res = await fetchAPI('users');
      if (res.success) {
        setUsers(res.data || []);
      }
    } catch (e) {
      console.error('Failed to load users', e);
    }
  };

  useEffect(() => {
    loadProjects();
    loadDevelopers();
    loadAllFiles();
    loadCampaigns();
    loadUsers();
  }, []);

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject?.name) {
      addToast('Tên dự án là bắt buộc', 'error');
      return;
    }
    if (!autoCode && !editingProject?.code) {
      addToast('Mã dự án là bắt buộc khi tắt tự động sinh mã', 'error');
      return;
    }

    try {
      const isNew = !editingProject.id;
      const action = isNew ? 'projects' : `projects/${editingProject.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetchAPI(action, {
        method,
        body: JSON.stringify(editingProject)
      });

      if (res.success) {
        addToast(isNew ? 'Tạo dự án thành công!' : 'Cập nhật dự án thành công!', 'success');
        setIsEditModalOpen(false);
        loadProjects();
      } else {
        addToast(res.message || 'Lỗi lưu thông tin', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
    }
  };

  const handleDeleteProject = (id: number) => {
    showConfirm({
      title: 'Xóa dự án',
      message: 'Bạn có chắc chắn muốn xóa dự án này không? Toàn bộ tài liệu, chiến dịch và roster liên quan sẽ bị ảnh hưởng.',
      confirmText: 'Xóa dự án',
      cancelText: 'Hủy',
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await fetchAPI(`projects/${id}`, { method: 'DELETE' });
          if (res.success) {
            addToast('Xóa dự án thành công!', 'success');
            loadProjects();
          } else {
            addToast(res.message || 'Lỗi xóa dự án', 'error');
          }
        } catch (e: any) {
          addToast(e.message || 'Lỗi kết nối', 'error');
        }
      }
    });
  };

  // Roster logic
  const handleOpenRoster = async (projectId: number) => {
    setSelectedProjectId(projectId);
    setIsRosterModalOpen(true);
    try {
      const res = await fetchAPI(`projects/${projectId}/roster`);
      if (res.success) {
        setRosterMembers(res.data || []);
      } else {
        addToast(res.message || 'Lỗi tải roster', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
    }
  };

  const handleToggleRoster = (uid: number) => {
    setRosterMembers(prev =>
      prev.map(m => (m.id === uid ? { ...m, is_assigned: m.is_assigned ? 0 : 1 } : m))
    );
  };

  const handleSaveRoster = async () => {
    if (!selectedProjectId) return;

    const assignedIds = rosterMembers.filter(m => m.is_assigned === 1).map(m => m.id);
    try {
      const res = await fetchAPI(`projects/${selectedProjectId}/roster`, {
        method: 'POST',
        body: JSON.stringify({ user_ids: assignedIds })
      });

      if (res.success) {
        addToast('Cập nhật roster dự án thành công!', 'success');
        setIsRosterModalOpen(false);
      } else {
        addToast(res.message || 'Lỗi lưu roster', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
    }
  };

  // Documents logic
  const handleOpenDocs = async (projectId: number) => {
    setSelectedProjectId(projectId);
    setIsDocsModalOpen(true);
    loadDocuments(projectId);
  };

  const loadDocuments = async (projectId: number) => {
    try {
      const res = await fetchAPI(`projects/${projectId}/documents`);
      if (res.success) {
        setProjectDocs(res.data || []);
      } else {
        addToast(res.message || 'Lỗi tải tài liệu', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !selectedProjectId) return;
    const file = e.target.files[0];

    setUploadingDoc(true);
    try {
      const compressedFile = await compressToWebP(file);
      const formData = new FormData();
      formData.append('file', compressedFile);
      const token = localStorage.getItem('access_token') || localStorage.getItem('richland_token') || '';
      const url = `${import.meta.env.VITE_API_URL || '/backend'}/api.php?action=projects/${selectedProjectId}/documents&token=${token}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Auth-Token': token
        },
        body: formData
      });

      const res = await response.json();
      if (res.success) {
        addToast('Tải tài liệu lên thành công!', 'success');
        loadDocuments(selectedProjectId);
      } else {
        addToast(res.message || 'Lỗi tải tài liệu lên', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi tải file', 'error');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDoc = (docId: number) => {
    if (!selectedProjectId) return;
    showConfirm({
      title: 'Xóa tài liệu',
      message: 'Bạn có chắc chắn muốn xóa tài liệu này không?',
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await fetchAPI(`projects/${selectedProjectId}/documents/${docId}`, { method: 'DELETE' });
          if (res.success) {
            addToast('Xóa tài liệu thành công!', 'success');
            loadDocuments(selectedProjectId);
          } else {
            addToast(res.message || 'Lỗi xóa tài liệu', 'error');
          }
        } catch (e: any) {
          addToast(e.message || 'Lỗi kết nối', 'error');
        }
      }
    });
  };

  const handleDownloadDoc = (docId: number) => {
    if (!selectedProjectId) return;
    const token = localStorage.getItem('access_token') || localStorage.getItem('richland_token') || '';
    const url = `${import.meta.env.VITE_API_URL || '/backend'}/api.php?action=projects/${selectedProjectId}/documents/${docId}/download&token=${token}`;
    window.open(url, '_blank');
  };

  return (
    <div className="page-container anim-fade-up" style={{ color: 'var(--color-text)' }}>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Quản Lý Dự Án</h1>
          <p className="page-subtitle">Đăng ký dự án, roster đội ngũ phân phối và quản lý tài liệu mật</p>
        </div>
        {isAdmin && activeSubTab === 'projects' && (
          <button
            onClick={() => {
              setEditingProject({ status: 'active' });
              setAutoCode(true);
              setProjectModalMode('create');
              setIsEditModalOpen(true);
            }}
            className="btn primary"
            style={{ height: '38px' }}
          >
            <Plus size={16} />
            Thêm dự án mới
          </button>
        )}
        {isAdmin && activeSubTab === 'campaigns' && (
          <button
            onClick={() => {
              setEditingCampaign({ name: '', description: '', status: 'active', start_date: '', end_date: '', project_ids: '', user_ids: '', manager_ids: '', document_ids: '', folder_path: '' });
              setCampaignModalMode('create');
              setIsCampaignModalOpen(true);
            }}
            className="btn primary"
            style={{ height: '38px' }}
          >
            <Plus size={16} />
            Thêm chiến dịch mới
          </button>
        )}
      </div>

      {/* Tab Selector */}
      <div style={{ display: 'flex', background: 'var(--color-border-light)', borderRadius: '12px', padding: '4px', alignSelf: 'flex-start', marginBottom: '1.5rem', width: 'fit-content', gap: '4px' }}>
        <button 
           style={{ padding: '8px 20px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700, background: activeSubTab === 'projects' ? 'var(--color-surface)' : 'transparent', color: activeSubTab === 'projects' ? 'var(--color-primary)' : 'var(--color-text-light)', boxShadow: activeSubTab === 'projects' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none', transition: 'all 0.2s', border: 'none', cursor: 'pointer' }}
           onClick={() => setActiveSubTab('projects')}
           className={activeSubTab === 'projects' ? '' : 'hover-lift'}
        >
          Dự án
        </button>
        <button 
           style={{ padding: '8px 20px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700, background: activeSubTab === 'campaigns' ? 'var(--color-surface)' : 'transparent', color: activeSubTab === 'campaigns' ? 'var(--color-primary)' : 'var(--color-text-light)', boxShadow: activeSubTab === 'campaigns' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none', transition: 'all 0.2s', border: 'none', cursor: 'pointer' }}
           onClick={() => setActiveSubTab('campaigns')}
           className={activeSubTab === 'campaigns' ? '' : 'hover-lift'}
        >
          Chiến dịch
        </button>
      </div>

      {/* Projects List */}
      {activeSubTab === 'projects' && (
        loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)' }}>Đang tải danh sách dự án...</div>
        ) : projects.length === 0 ? (
          <EmptyCard 
            icon={<Building2 size={48} />}
            title="Chưa có dự án nào"
            description="Bắt đầu đăng ký các dự án bất động sản để phân phối và quản lý tài liệu."
            actionText="Thêm ngay"
            onAction={() => {
              setEditingProject({ status: 'active' });
              setAutoCode(true);
              setIsEditModalOpen(true);
            }}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {projects.map(proj => (
              <div
                key={proj.id}
                className="card flex flex-col justify-between hover:border-primary/50 transition-all duration-200"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div 
                      className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => {
                        setEditingProject(proj);
                        setProjectModalMode('view');
                        setIsEditModalOpen(true);
                      }}
                    >
                      <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500" style={{ color: '#3b82f6' }}>
                        <Building2 size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>{proj.name}</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                          <span className="text-xs text-gray-500 font-mono">Mã: {proj.code}</span>
                          {proj.developer && <span className="text-xs text-gray-500">Chủ đầu tư: <strong>{proj.developer}</strong></span>}
                          {proj.location && <span className="text-xs text-gray-500">Vị trí: <strong>{proj.location}</strong></span>}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                        proj.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                      }`}
                    >
                      {proj.status === 'active' ? 'Đang bán' : 'Tạm dừng'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 line-clamp-3 mb-4" style={{ color: 'var(--color-text-muted)' }}>{proj.description || 'Không có mô tả'}</p>

                  {/* Construction Progress Bar */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.75rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>Tiến độ: {proj.construction_status || 'Chưa khởi công'}</span>
                      <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{proj.progress_percent ?? 0}%</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'var(--color-border)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${proj.progress_percent ?? 0}%`, height: '100%', background: 'var(--color-primary)', borderRadius: '3px', transition: 'width 0.3s ease' }}></div>
                    </div>
                  </div>

                  {/* Project Details Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '1rem', padding: '10px', background: 'var(--color-bg)', borderRadius: '8px', border: '1px solid var(--color-border-light)', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    <div>Pháp lý: <strong style={{ color: 'var(--color-text)' }}>{proj.legal_status || 'Đang hoàn thiện'}</strong></div>
                    <div>Bàn giao: <strong style={{ color: 'var(--color-text)' }}>{proj.handover_year || 2026}</strong></div>
                    <div>Quy mô: <strong style={{ color: 'var(--color-text)' }}>{proj.scale_block_count || 1} Block</strong></div>
                    <div>Số căn: <strong style={{ color: 'var(--color-text)' }}>{proj.scale_unit_count || 100} căn</strong></div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', fontSize: '0.75rem', color: 'var(--color-text-light)' }}>
                    <span 
                      onClick={() => handleOpenRoster(proj.id)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--color-bg)', padding: '4px 8px', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-border-light)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--color-bg)'}
                    >
                      <Users size={12} /> {proj.roster_count || 0} nhân sự
                    </span>
                    <span 
                      onClick={() => handleOpenDocs(proj.id)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--color-bg)', padding: '4px 8px', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-border-light)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--color-bg)'}
                    >
                      <FileText size={12} /> {proj.doc_count || 0} tài liệu
                    </span>
                  </div>

                  {/* Linked Campaigns & Documents display on Project Card */}
                  {((proj.campaign_ids && parseIds(proj.campaign_ids).length > 0) || (proj.document_ids && parseIds(proj.document_ids).length > 0)) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px', padding: '12px', background: 'var(--color-bg)', borderRadius: '10px', fontSize: '0.75rem', border: '1px solid var(--color-border)' }}>
                      {proj.campaign_ids && parseIds(proj.campaign_ids).length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '4px', minWidth: '70px' }}>
                            <Layers size={12} className="text-primary" /> Chiến dịch:
                          </span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {parseIds(proj.campaign_ids).map(cName => (
                              <span key={cName} style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.6875rem', fontWeight: 700 }}>
                                {cName}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {proj.document_ids && parseIds(proj.document_ids).length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                            <FileText size={12} className="text-primary" /> Tài liệu liên kết:
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '8px' }}>
                            {parseIds(proj.document_ids).map(docId => {
                              const fileObj = allFiles.find(f => String(f.id) === String(docId));
                              if (!fileObj) return null;
                              return (
                                <a
                                  key={docId}
                                  href={`${import.meta.env.VITE_API_URL ?? '/backend'}/${fileObj.file_path}`}
                                  download={fileObj.name}
                                  title={fileObj.name}
                                  style={{ color: 'var(--color-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600 }}
                                  onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                                  onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                                >
                                  • {formatFileName(fileObj.name)}
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4" style={{ borderTop: '1px solid var(--color-border)', marginTop: '1rem' }}>
                  <button
                    onClick={() => handleOpenDocs(proj.id)}
                    className="btn secondary sm flex-1 flex justify-center items-center gap-1.5"
                  >
                    <FileText size={14} />
                    Tài liệu mật
                  </button>
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => handleOpenRoster(proj.id)}
                        className="btn secondary sm"
                        title="Roster nhân viên"
                      >
                        <Users size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingProject(proj);
                          setAutoCode(false);
                          setProjectModalMode('edit');
                          setIsEditModalOpen(true);
                        }}
                        className="btn secondary sm"
                        title="Sửa"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteProject(proj.id)}
                        className="btn secondary sm"
                        style={{ color: 'var(--color-danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                        title="Xóa"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Campaigns List Tab */}
      {activeSubTab === 'campaigns' && (
        campaignsLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)' }}>Đang tải danh sách chiến dịch...</div>
        ) : campaigns.length === 0 ? (
          <EmptyCard
            icon={<Layers size={48} />}
            title="Chưa có chiến dịch nào"
            description="Bắt đầu tạo chiến dịch marketing để quản lý nguồn lead thu về."
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {campaigns.map(camp => {
              const linkedProjects = projects.filter(p => 
                p.campaign_ids && parseIds(p.campaign_ids).includes(camp.name)
              );
              return (
                <div
                  key={camp.id}
                  className="card flex flex-col justify-between hover:border-primary/50 transition-all duration-200"
                  style={{ background: 'var(--color-surface)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--color-border)' }}
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div 
                        className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => {
                          setEditingCampaign(camp);
                          setCampaignModalMode('view');
                          setIsCampaignModalOpen(true);
                        }}
                      >
                        <div className="p-3 bg-primary/10 rounded-lg text-primary" style={{ color: 'var(--color-primary)', background: 'var(--color-primary-light)' }}>
                          <Layers size={24} />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>{camp.name}</h3>
                          <span className="text-xs text-gray-500 font-mono">ID: {camp.id}</span>
                        </div>
                      </div>
                      <span 
                        className={`badge ${camp.status === 'active' ? 'success' : 'secondary'}`}
                        style={{ 
                          whiteSpace: 'nowrap', 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '6px', 
                          fontSize: '0.725rem', 
                          padding: '3px 8px', 
                          borderRadius: '30px', 
                          fontWeight: 700,
                          lineHeight: 1
                        }}
                      >
                        <span style={{ 
                          width: 6, 
                          height: 6, 
                          borderRadius: '50%', 
                          background: camp.status === 'active' ? '#22c55e' : '#94a3b8', 
                          display: 'inline-block' 
                        }}></span>
                        {camp.status === 'active' ? 'Hoạt động' : 'Tạm dừng'}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-400 mb-4" style={{ color: 'var(--color-text-muted)' }}>
                      {camp.description || 'Không có mô tả chi tiết cho chiến dịch này.'}
                    </p>
                    
                    {/* Linked Projects list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem', marginTop: '12px', padding: '8px 12px', background: 'var(--color-bg)', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}>
                      <span style={{ fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                        <Building2 size={12} className="text-primary" /> Dự án liên kết ({linkedProjects.length})
                      </span>
                      {linkedProjects.length === 0 ? (
                        <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Chưa có dự án nào liên kết</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {linkedProjects.map(proj => (
                            <div key={proj.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--color-text)' }}>
                              <span style={{ fontWeight: 600 }}>• {proj.name}</span>
                              <span style={{ fontSize: '0.65rem', background: 'var(--color-surface)', padding: '1px 4px', borderRadius: '3px', border: '1px solid var(--color-border)' }}>{proj.code}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="flex gap-2 mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border-light)' }}>
                      <button
                        onClick={() => {
                          setEditingCampaign(camp);
                          setCampaignModalMode('edit');
                          setIsCampaignModalOpen(true);
                        }}
                        className="btn secondary sm flex-1 flex justify-center items-center gap-1.5"
                      >
                        <Edit size={14} />
                        Sửa
                      </button>
                      <button
                        onClick={() => handleDeleteCampaign(camp.id)}
                        className="btn secondary sm"
                        style={{ color: 'var(--color-danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Edit Modal */}
      {isEditModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="overlay-backdrop" onClick={() => setIsEditModalOpen(false)} style={{ zIndex: 11000 }}>
          <div className="modal-sheet modal-md" onClick={e => e.stopPropagation()} style={{ animation: 'scaleUp 0.2s ease-out', maxWidth: '700px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, color: 'var(--color-text)' }}>
                {projectModalMode === 'view' 
                  ? `Chi tiết Dự án: ${editingProject?.name}` 
                  : editingProject?.id ? 'Chỉnh sửa dự án' : 'Thêm dự án mới'}
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}><X size={20} /></button>
            </div>
            
            {projectModalMode === 'view' ? (
              <div className="modal-body" style={{ overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '1.25rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Tên dự án</span>
                    <strong style={{ color: 'var(--color-text)', fontSize: '1rem' }}>{editingProject?.name}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Mã dự án</span>
                    <strong style={{ color: 'var(--color-text)', fontSize: '1rem', fontFamily: 'monospace' }}>{editingProject?.code}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Chủ đầu tư</span>
                    <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{editingProject?.developer || 'Chưa cập nhật'}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Trạng thái bán</span>
                    <span 
                      className={`badge ${editingProject?.status === 'active' ? 'success' : 'secondary'}`}
                      style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: '4px', fontWeight: 700 }}
                    >
                      {editingProject?.status === 'active' ? 'Đang mở bán' : 'Tạm dừng bán'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '1.25rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Vị trí / Địa chỉ</span>
                    <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{editingProject?.location || 'Chưa cập nhật'}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Trạng thái thi công & Tiến độ</span>
                    <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>
                      {editingProject?.construction_status || 'Chưa khởi công'} ({editingProject?.progress_percent ?? 0}%)
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Trạng thái pháp lý</span>
                    <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{editingProject?.legal_status || 'Đang hoàn thiện pháp lý'}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Năm bàn giao dự kiến</span>
                    <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{editingProject?.handover_year || 2026}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Quy mô Block & Căn hộ</span>
                    <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>
                      {editingProject?.scale_block_count || 1} Block, {editingProject?.scale_unit_count || 100} căn hộ
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Đường dẫn Folder</span>
                    <span style={{ color: 'var(--color-text)', fontWeight: 600, wordBreak: 'break-all', fontFamily: 'monospace' }}>
                      {editingProject?.folder_path || 'Không có folder liên kết'}
                    </span>
                  </div>
                </div>

                <div style={{ borderBottom: '1px solid var(--color-border-light)', paddingBottom: '1.25rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Manager phụ trách chính</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {parseIds(editingProject?.manager_ids).length === 0 ? (
                      <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Chưa phân công manager phụ trách</span>
                    ) : (
                      parseIds(editingProject?.manager_ids).map(id => {
                        const u = users.find(usr => String(usr.id) === String(id));
                        if (!u) return null;
                        return (
                          <span key={id} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)' }}>
                            {u.fullname || u.username} ({u.role})
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>

                <div style={{ borderBottom: '1px solid var(--color-border-light)', paddingBottom: '1.25rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Tài liệu mật liên kết</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {parseIds(editingProject?.document_ids).length === 0 ? (
                      <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Chưa liên kết tài liệu mật</span>
                    ) : (
                      parseIds(editingProject?.document_ids).map(docId => {
                        const fileObj = allFiles.find(f => String(f.id) === String(docId));
                        if (!fileObj) return null;
                        return (
                          <a
                            key={docId}
                            href={`${import.meta.env.VITE_API_URL ?? '/backend'}/${fileObj.file_path}`}
                            download={fileObj.name}
                            title={fileObj.name}
                            style={{ color: 'var(--color-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600 }}
                            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                          >
                            <FileText size={14} /> {formatFileName(fileObj.name, 45)}
                          </a>
                        );
                      })
                    )}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Mô tả chi tiết</span>
                  <p style={{ color: 'var(--color-text)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5, fontSize: '0.875rem' }}>
                    {editingProject?.description || 'Không có mô tả chi tiết'}
                  </p>
                </div>
                
                <div className="modal-footer" style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem', marginTop: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn primary" onClick={() => setIsEditModalOpen(false)}>Đóng</button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveProject} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                <div className="modal-body" style={{ overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', padding: '1.5rem' }}>
                  <div>
                    <label className="form-label">Tên dự án</label>
                    <input
                      type="text"
                      required
                      value={editingProject?.name || ''}
                      onChange={e => {
                        const val = e.target.value;
                        setEditingProject(prev => {
                          const next = { ...prev, name: val };
                          if (autoCode && !prev?.id) {
                            next.code = generateCodeFromName(val);
                          }
                          return next;
                        });
                      }}
                      className="form-input"
                      placeholder="Nhập tên dự án..."
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label className="form-label" style={{ marginBottom: 0 }}>Mã dự án</label>
                      {!editingProject?.id && (
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={autoCode}
                            onChange={e => {
                              const checked = e.target.checked;
                              setAutoCode(checked);
                              if (checked && editingProject?.name) {
                                setEditingProject(prev => ({ ...prev, code: generateCodeFromName(prev?.name || '') }));
                              }
                            }}
                            style={{ accentColor: 'var(--color-primary)' }}
                          />
                          Tự động tạo mã
                        </label>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      disabled={autoCode && !editingProject?.id}
                      value={editingProject?.code || ''}
                      onChange={e => {
                        setAutoCode(false);
                        setEditingProject(prev => ({ ...prev, code: e.target.value.toUpperCase() }));
                      }}
                      className="form-input"
                      placeholder={autoCode && !editingProject?.id ? 'Hệ thống tự động sinh' : 'Ví dụ: VGP'}
                    />
                  </div>

                  <div>
                    <label className="form-label">Chủ đầu tư</label>
                    {developers.length === 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)', fontWeight: 600 }}>
                          Chưa có chủ đầu tư nào trong hệ thống!
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditModalOpen(false);
                            navigate('/suppliers');
                          }}
                          className="btn primary sm"
                          style={{ width: '100%', height: '38px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Plus size={12} style={{ marginRight: '4px' }} />
                          Thêm chủ đầu tư trước
                        </button>
                      </div>
                    ) : (
                      <CustomSelect
                        searchable={true}
                        options={developers.map(d => ({ value: d.name, label: d.name }))}
                        value={editingProject?.developer || ''}
                        onChange={val => setEditingProject(prev => ({ ...prev, developer: String(val) }))}
                        placeholder="Chọn chủ đầu tư..."
                      />
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0.875rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-light)', height: '44px' }}>
                      <div>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>Trạng thái bán</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: editingProject?.status === 'active' ? 'var(--color-emerald)' : 'var(--color-text-muted)' }}>
                          {editingProject?.status === 'active' ? 'Đang mở bán' : 'Tạm dừng bán'}
                        </span>
                        <ToggleSwitch
                          checked={editingProject?.status === 'active'}
                          onChange={checked => setEditingProject(prev => ({ ...prev, status: checked ? 'active' : 'inactive' }))}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <AddressSelect
                      label="Vị trí / Địa chỉ dự án"
                      value={editingProject?.location || ''}
                      onChange={val => setEditingProject(prev => ({ ...prev, location: val }))}
                      placeholder="Nhấp để chọn tỉnh/thành phố, xã/phường và số nhà..."
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Manager phụ trách chính (Chọn nhiều)</label>
                    <CustomSelect
                      multiple
                      searchable={true}
                      options={users
                        .filter(u => ['manager', 'director', 'admin', 'superadmin', 'super_admin'].includes(u.role))
                        .map(u => ({ value: String(u.id), label: `${u.fullname || u.username} (${u.role})` }))
                      }
                      value={parseIds(editingProject?.manager_ids)}
                      onChange={val => setEditingProject(prev => ({ ...prev, manager_ids: Array.isArray(val) ? val.join(',') : String(val) }))}
                      placeholder="Chọn các manager phụ trách..."
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Tài liệu liên kết</label>
                    <CustomSelect
                      multiple
                      searchable={true}
                      options={allFiles.map(f => ({ value: String(f.id), label: f.name }))}
                      value={parseIds(editingProject?.document_ids)}
                      onChange={val => setEditingProject(prev => ({ ...prev, document_ids: Array.isArray(val) ? val.join(',') : String(val) }))}
                      placeholder="Chọn tài liệu liên kết..."
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Chiến dịch liên kết</label>
                    <CustomSelect
                      multiple
                      searchable={true}
                      options={campaigns.map(c => ({ value: c.name, label: c.name }))}
                      value={parseIds(editingProject?.campaign_ids)}
                      onChange={val => setEditingProject(prev => ({ ...prev, campaign_ids: Array.isArray(val) ? val.join(',') : String(val) }))}
                      placeholder="Chọn chiến dịch liên kết..."
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Đường dẫn Folder liên kết</label>
                    <input
                      type="text"
                      value={editingProject?.folder_path || ''}
                      onChange={e => setEditingProject(prev => ({ ...prev, folder_path: e.target.value }))}
                      className="form-input"
                      placeholder="Ví dụ: /shared/projects/folder_a"
                    />
                  </div>

                  <div>
                    <label className="form-label">Tiến độ thi công (%)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={editingProject?.progress_percent ?? 0}
                        onChange={e => setEditingProject(prev => ({ ...prev, progress_percent: Number(e.target.value) }))}
                        style={{ flex: 1, accentColor: 'var(--color-primary)' }}
                      />
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, width: '40px', textAlign: 'right' }}>
                        {editingProject?.progress_percent ?? 0}%
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Trạng thái thi công</label>
                    <CustomSelect
                      searchable={true}
                      options={[
                        { value: 'Chưa khởi công', label: 'Chưa khởi công' },
                        { value: 'Đang thi công móng', label: 'Đang thi công móng' },
                        { value: 'Đang xây thân', label: 'Đang xây thân' },
                        { value: 'Đã cất nóc', label: 'Đã cất nóc' },
                        { value: 'Đang hoàn thiện', label: 'Đang hoàn thiện' },
                        { value: 'Đã bàn giao', label: 'Đã bàn giao' }
                      ]}
                      value={editingProject?.construction_status || 'Chưa khởi công'}
                      onChange={val => setEditingProject(prev => ({ ...prev, construction_status: String(val) }))}
                    />
                  </div>

                  <div>
                    <label className="form-label">Trạng thái pháp lý</label>
                    <CustomSelect
                      searchable={true}
                      options={[
                        { value: 'Đang hoàn thiện pháp lý', label: 'Đang hoàn thiện pháp lý' },
                        { value: 'Quy hoạch 1/500', label: 'Quy hoạch 1/500' },
                        { value: 'Giấy phép xây dựng', label: 'Giấy phép xây dựng' },
                        { value: 'Sổ hồng riêng từng căn', label: 'Sổ hồng riêng từng căn' }
                      ]}
                      value={editingProject?.legal_status || 'Đang hoàn thiện pháp lý'}
                      onChange={val => setEditingProject(prev => ({ ...prev, legal_status: String(val) }))}
                    />
                  </div>

                  <div>
                    <label className="form-label">Năm bàn giao dự kiến</label>
                    <input
                      type="number"
                      value={editingProject?.handover_year ?? 2026}
                      onChange={e => setEditingProject(prev => ({ ...prev, handover_year: Number(e.target.value) }))}
                      className="form-input"
                      placeholder="ví dụ: 2026"
                    />
                  </div>

                  <div>
                    <label className="form-label">Quy mô: Số Block</label>
                    <input
                      type="number"
                      value={editingProject?.scale_block_count ?? 1}
                      onChange={e => setEditingProject(prev => ({ ...prev, scale_block_count: Number(e.target.value) }))}
                      className="form-input"
                      placeholder="ví dụ: 2"
                    />
                  </div>

                  <div>
                    <label className="form-label">Quy mô: Số Căn hộ</label>
                    <input
                      type="number"
                      value={editingProject?.scale_unit_count ?? 100}
                      onChange={e => setEditingProject(prev => ({ ...prev, scale_unit_count: Number(e.target.value) }))}
                      className="form-input"
                      placeholder="ví dụ: 500"
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Mô tả chi tiết</label>
                    <textarea
                      value={editingProject?.description || ''}
                      onChange={e => setEditingProject(prev => ({ ...prev, description: e.target.value }))}
                      className="form-textarea"
                      style={{ minHeight: '100px' }}
                      placeholder="Nhập mô tả thông tin dự án..."
                    />
                  </div>
                </div>
                
                <div className="modal-footer" style={{ borderTop: '1px solid var(--color-border-light)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" className="btn" onClick={() => setIsEditModalOpen(false)}>Hủy</button>
                  <button type="submit" className="btn primary">Lưu dự án</button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Roster Modal */}
      {isRosterModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="overlay-backdrop" onClick={() => setIsRosterModalOpen(false)} style={{ zIndex: 1000 }}>
          <div className="modal-sheet modal-md" onClick={e => e.stopPropagation()} style={{ animation: 'scaleUp 0.2s ease-out' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, color: 'var(--color-text)' }}>Cấu hình Roster Nhân Sự Phân Phối</h3>
              <button onClick={() => setIsRosterModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {rosterMembers.length === 0 ? (
                  <div style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '2rem 0' }}>Không tìm thấy tài khoản Sales khả dụng</div>
                ) : (
                  rosterMembers.map(member => (
                    <div
                      key={member.id}
                      onClick={() => handleToggleRoster(member.id)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-lg)',
                        border: member.is_assigned ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                        background: member.is_assigned ? 'var(--color-primary-light)' : 'var(--color-surface)',
                        cursor: 'pointer'
                      }}
                    >
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>{member.full_name}</h4>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{member.email}</p>
                      </div>
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '4px',
                          border: member.is_assigned ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                          backgroundColor: member.is_assigned ? 'var(--color-primary)' : 'transparent',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {member.is_assigned === 1 && <Check size={14} />}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setIsRosterModalOpen(false)}>Hủy</button>
              <button type="button" className="btn primary" onClick={handleSaveRoster}>Lưu thay đổi</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Documents Modal */}
      {isDocsModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="overlay-backdrop" onClick={() => setIsDocsModalOpen(false)} style={{ zIndex: 1000 }}>
          <div className="modal-sheet modal-md" onClick={e => e.stopPropagation()} style={{ animation: 'scaleUp 0.2s ease-out' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, color: 'var(--color-text)' }}>Kho Tài Liệu Dự Án (Mật)</h3>
              <button onClick={() => setIsDocsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', gap: '1rem' }}>
              {/* Upload Area for Admins */}
              {isAdmin && (
                <div style={{
                  padding: '1rem',
                  border: '1px dashed var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--color-surface-hover)'
                }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>Tải tài liệu mới lên</h4>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Chấp nhận file PDF, Word, Excel, Hình ảnh</p>
                  </div>
                  <label className="btn secondary sm" style={{ cursor: 'pointer' }}>
                    <Upload size={14} />
                    {uploadingDoc ? 'Đang tải...' : 'Chọn file'}
                    <input type="file" disabled={uploadingDoc} onChange={handleUploadFile} style={{ display: 'none' }} />
                  </label>
                </div>
              )}

              {/* List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {projectDocs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--color-text-muted)' }}>Chưa có tài liệu nào cho dự án này</div>
                ) : (
                  projectDocs.map(doc => (
                    <div
                      key={doc.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem 1rem',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-lg)',
                        background: 'var(--color-surface)'
                      }}
                    >
                      <div style={{ flex: 1, marginRight: '1rem', minWidth: 0 }}>
                        <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</h4>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          {doc.uploaded_by_name} • {(doc.file_size / 1024 / 1024).toFixed(2)} MB • {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleDownloadDoc(doc.id)}
                          className="btn secondary sm"
                          style={{ minWidth: 'auto', padding: '0 0.5rem' }}
                        >
                          <Download size={14} />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteDoc(doc.id)}
                            className="btn danger sm"
                            style={{ minWidth: 'auto', padding: '0 0.5rem', backgroundColor: 'var(--color-red-light)', borderColor: 'var(--color-red-light)', color: 'var(--color-red)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setIsDocsModalOpen(false)}>Đóng</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Campaign Create/Edit Modal */}
      {isCampaignModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="overlay-backdrop" onClick={() => setIsCampaignModalOpen(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 11000 }}>
          <div className="card" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 650, maxHeight: '90vh', display: 'flex', flexDirection: 'column', animation: 'modalSpring 0.4s cubic-bezier(0.34, 1.18, 0.64, 1) both', margin: 'auto', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', borderBottom: '1px solid var(--color-border-light)' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
                {campaignModalMode === 'view' 
                  ? `Chi tiết Chiến dịch: ${editingCampaign?.name}` 
                  : editingCampaign?.id ? 'Chỉnh sửa Chiến dịch' : 'Thêm Chiến dịch mới'}
              </h3>
              <button type="button" onClick={() => setIsCampaignModalOpen(false)} style={{ color: 'var(--color-text-muted)', padding: 4, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {campaignModalMode === 'view' ? (
              <div style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '1.25rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Tên chiến dịch</span>
                    <strong style={{ color: 'var(--color-text)', fontSize: '1rem' }}>{editingCampaign?.name}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Trạng thái hoạt động</span>
                    <span 
                      className={`badge ${editingCampaign?.status === 'active' ? 'success' : 'secondary'}`}
                      style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: '4px', fontWeight: 700 }}
                    >
                      {editingCampaign?.status === 'active' ? 'Hoạt động' : 'Tạm dừng'}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Ngày bắt đầu</span>
                    <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{editingCampaign?.start_date || 'Chưa thiết lập'}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Ngày kết thúc</span>
                    <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{editingCampaign?.end_date || 'Chưa thiết lập'}</span>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Đường dẫn Folder</span>
                    <span style={{ color: 'var(--color-text)', fontWeight: 600, wordBreak: 'break-all', fontFamily: 'monospace' }}>
                      {editingCampaign?.folder_path || 'Không có folder liên kết'}
                    </span>
                  </div>
                </div>

                <div style={{ borderBottom: '1px solid var(--color-border-light)', paddingBottom: '1.25rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Dự án liên kết (Click để xem chi tiết)</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {parseIds(editingCampaign?.project_ids).length === 0 ? (
                      <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Chưa liên kết dự án nào</span>
                    ) : (
                      parseIds(editingCampaign?.project_ids).map(projName => {
                        const pObj = projects.find(p => p.name === projName);
                        return (
                          <span 
                            key={projName} 
                            onClick={() => {
                              if (pObj) {
                                setEditingProject(pObj);
                                setProjectModalMode('view');
                                setIsCampaignModalOpen(false);
                                setIsEditModalOpen(true);
                              }
                            }}
                            style={{ 
                              background: 'var(--color-primary-light)', 
                              color: 'var(--color-primary)', 
                              border: '1px solid rgba(163, 20, 34, 0.2)', 
                              padding: '4px 10px', 
                              borderRadius: '20px', 
                              fontSize: '0.75rem', 
                              fontWeight: 600, 
                              cursor: pObj ? 'pointer' : 'default',
                              textDecoration: pObj ? 'underline' : 'none'
                            }}
                          >
                            {projName}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>

                <div style={{ borderBottom: '1px solid var(--color-border-light)', paddingBottom: '1.25rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Manager phụ trách chính</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {parseIds(editingCampaign?.manager_ids).length === 0 ? (
                      <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Chưa phân công manager phụ trách</span>
                    ) : (
                      parseIds(editingCampaign?.manager_ids).map(id => {
                        const u = users.find(usr => String(usr.id) === String(id));
                        if (!u) return null;
                        return (
                          <span key={id} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)' }}>
                            {u.fullname || u.username} ({u.role})
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>

                <div style={{ borderBottom: '1px solid var(--color-border-light)', paddingBottom: '1.25rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Nhân sự liên kết</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {parseIds(editingCampaign?.user_ids).length === 0 ? (
                      <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Chưa liên kết nhân sự</span>
                    ) : (
                      parseIds(editingCampaign?.user_ids).map(id => {
                        const u = users.find(usr => String(usr.id) === String(id));
                        if (!u) return null;
                        return (
                          <span key={id} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)' }}>
                            {u.fullname || u.username}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>

                <div style={{ borderBottom: '1px solid var(--color-border-light)', paddingBottom: '1.25rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Tài liệu đính kèm</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {parseIds(editingCampaign?.document_ids).length === 0 ? (
                      <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Chưa liên kết tài liệu</span>
                    ) : (
                      parseIds(editingCampaign?.document_ids).map(docId => {
                        const fileObj = allFiles.find(f => String(f.id) === String(docId));
                        if (!fileObj) return null;
                        return (
                          <a
                            key={docId}
                            href={`${import.meta.env.VITE_API_URL ?? '/backend'}/${fileObj.file_path}`}
                            download={fileObj.name}
                            title={fileObj.name}
                            style={{ color: 'var(--color-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600 }}
                            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                          >
                            <FileText size={14} /> {formatFileName(fileObj.name, 45)}
                          </a>
                        );
                      })
                    )}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Mô tả chiến dịch</span>
                  <p style={{ color: 'var(--color-text)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5, fontSize: '0.875rem' }}>
                    {editingCampaign?.description || 'Không có mô tả chi tiết'}
                  </p>
                </div>

                <div style={{ padding: '1rem 0 0 0', borderTop: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn primary sm" onClick={() => setIsCampaignModalOpen(false)}>Đóng</button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveCampaign} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', maxHeight: '70vh' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Tên Chiến dịch <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ví dụ: Facebook Lead Ads - HCMC"
                      value={editingCampaign?.name || ''}
                      onChange={e => setEditingCampaign({ ...editingCampaign, name: e.target.value })}
                      required
                      autoFocus
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600 }}>Ngày bắt đầu</label>
                      <input
                        type="date"
                        className="form-input"
                        value={editingCampaign?.start_date || ''}
                        onChange={e => setEditingCampaign({ ...editingCampaign, start_date: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600 }}>Ngày kết thúc</label>
                      <input
                        type="date"
                        className="form-input"
                        value={editingCampaign?.end_date || ''}
                        onChange={e => setEditingCampaign({ ...editingCampaign, end_date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Dự án liên kết (Chọn nhiều)</label>
                    <CustomSelect
                      multiple
                      searchable={true}
                      options={projects.map(p => ({ value: p.name, label: `${p.name} (${p.code})` }))}
                      value={parseIds(editingCampaign?.project_ids)}
                      onChange={val => setEditingCampaign({ ...editingCampaign, project_ids: Array.isArray(val) ? val.join(',') : String(val) })}
                      placeholder="Chọn các dự án liên kết..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Manager phụ trách chính (Chọn nhiều)</label>
                    <CustomSelect
                      multiple
                      searchable={true}
                      options={users
                        .filter(u => ['manager', 'director', 'admin', 'superadmin', 'super_admin'].includes(u.role))
                        .map(u => ({ value: String(u.id), label: `${u.fullname || u.username} (${u.role})` }))
                      }
                      value={parseIds(editingCampaign?.manager_ids)}
                      onChange={val => setEditingCampaign({ ...editingCampaign, manager_ids: Array.isArray(val) ? val.join(',') : String(val) })}
                      placeholder="Chọn manager phụ trách..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Nhân sự liên kết (Chọn nhiều)</label>
                    <CustomSelect
                      multiple
                      searchable={true}
                      options={users.map(u => ({ value: String(u.id), label: `${u.fullname || u.username} (${u.role})` }))}
                      value={parseIds(editingCampaign?.user_ids)}
                      onChange={val => setEditingCampaign({ ...editingCampaign, user_ids: Array.isArray(val) ? val.join(',') : String(val) })}
                      placeholder="Chọn các nhân sự liên kết..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Tài liệu đính kèm (Chọn nhiều)</label>
                    <CustomSelect
                      multiple
                      searchable={true}
                      options={allFiles.map(f => ({ value: String(f.id), label: f.name }))}
                      value={parseIds(editingCampaign?.document_ids)}
                      onChange={val => setEditingCampaign({ ...editingCampaign, document_ids: Array.isArray(val) ? val.join(',') : String(val) })}
                      placeholder="Chọn tài liệu đính kèm..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Đường dẫn Folder liên kết</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ví dụ: /shared/campaigns/fb_leads"
                      value={editingCampaign?.folder_path || ''}
                      onChange={e => setEditingCampaign({ ...editingCampaign, folder_path: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Mô tả</label>
                    <textarea
                      className="form-input"
                      placeholder="Mô tả mục tiêu, nguồn lead, ngân sách..."
                      rows={3}
                      value={editingCampaign?.description || ''}
                      onChange={e => setEditingCampaign({ ...editingCampaign, description: e.target.value })}
                      style={{ minHeight: '80px', padding: '10px 14px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Trạng thái</label>
                    <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--color-bg)', padding: '4px', borderRadius: 'var(--radius-lg)' }}>
                      <button
                        type="button"
                        onClick={() => setEditingCampaign({ ...editingCampaign, status: 'active' })}
                        style={{
                          flex: 1, padding: '0.5rem', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.75rem',
                          background: editingCampaign?.status === 'active' ? 'white' : 'transparent',
                          color: editingCampaign?.status === 'active' ? 'var(--color-success)' : 'var(--color-text-muted)',
                          boxShadow: editingCampaign?.status === 'active' ? 'var(--shadow-sm)' : 'none',
                          transition: 'all 0.2s', border: 'none', cursor: 'pointer'
                        }}
                      >
                        Hoạt động
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCampaign({ ...editingCampaign, status: 'inactive' })}
                        style={{
                          flex: 1, padding: '0.5rem', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.75rem',
                          background: editingCampaign?.status === 'inactive' ? 'white' : 'transparent',
                          color: editingCampaign?.status === 'inactive' ? 'var(--color-danger)' : 'var(--color-text-muted)',
                          boxShadow: editingCampaign?.status === 'inactive' ? 'var(--shadow-sm)' : 'none',
                          transition: 'all 0.2s', border: 'none', cursor: 'pointer'
                        }}
                      >
                        Tạm dừng
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '1rem 1.25rem', background: 'var(--color-bg)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" className="btn outline sm" onClick={() => setIsCampaignModalOpen(false)}>Hủy</button>
                  <button type="submit" className="btn primary sm">Lưu lại</button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
