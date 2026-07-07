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
import { CustomModal } from '../components/ui/CustomModal';
import { Pagination } from '../components/ui/Pagination';



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
  created_by?: number;
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
  isLinkedOnly?: boolean;
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
  const [totalProjects, setTotalProjects] = useState(0);
  const [totalCampaigns, setTotalCampaigns] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'campaigns') {
      setActiveSubTab('campaigns');
    } else {
      setActiveSubTab('projects');
    }
  }, [window.location.search]);

  const [projectPage, setProjectPage] = useState(1);
  const projectPageSize = 12;
  const [campaignPage, setCampaignPage] = useState(1);
  const campaignPageSize = 12;

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

  const [campaignRosters, setCampaignRosters] = useState<Record<number, any[]>>({});
  const [campaignRostersLoading, setCampaignRostersLoading] = useState(false);

  const fetchCampaignRosters = async (camp: any) => {
    setCampaignRostersLoading(true);
    const pObjs = projects.filter(p => {
      const campIds = p.campaign_ids ? p.campaign_ids.split(',').map((id: string) => id.trim()) : [];
      return campIds.includes(camp?.name);
    });
    const rosters: Record<number, any[]> = {};
    for (const p of pObjs) {
      try {
        const res = await fetchAPI(`projects/${p.id}/roster`);
        if (res && Array.isArray(res)) {
          rosters[p.id] = res.filter((m: any) => m.is_assigned === 1);
        }
      } catch (e) {
        console.error(e);
      }
    }
    setCampaignRosters(rosters);
    setCampaignRostersLoading(false);
  };

  const handleOpenCampaignView = (camp: any) => {
    setEditingCampaign(camp);
    setCampaignModalMode('view');
    setIsCampaignModalOpen(true);
    fetchCampaignRosters(camp);
  };

  const isAdmin = user && ['admin', 'superadmin', 'super_admin', 'manager', 'director'].includes(user.role);
  const isSystemAdmin = user && ['admin', 'superadmin', 'super_admin'].includes(user.role);
  const canEditDeleteProject = (proj: Project) => {
    if (!user) return false;
    if (isSystemAdmin) return true;
    return String(proj.created_by) === String(user.id);
  };

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
      const res = await fetchAPI(`projects?page=${projectPage}&limit=${projectPageSize}`);
      if (res.success) {
        if (res.data && typeof res.data === 'object' && 'data' in res.data) {
          setProjects(res.data.data || []);
          setTotalProjects(Number(res.data.total || 0));
        } else {
          const arr = Array.isArray(res.data) ? res.data : [];
          setProjects(arr);
          setTotalProjects(arr.length);
        }
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
      const res = await fetchAPI(`campaigns?page=${campaignPage}&limit=${campaignPageSize}`);
      if (res.success) {
        if (res.data && typeof res.data === 'object' && 'data' in res.data) {
          setCampaigns(res.data.data || []);
          setTotalCampaigns(Number(res.data.total || 0));
        } else {
          const arr = Array.isArray(res.data) ? res.data : [];
          setCampaigns(arr);
          setTotalCampaigns(arr.length);
        }
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
  }, [projectPage, projectPageSize]);

  useEffect(() => {
    loadCampaigns();
  }, [campaignPage, campaignPageSize]);

  useEffect(() => {
    loadDevelopers();
    loadAllFiles();
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
      <div style={{
        display: 'flex',
        background: 'rgba(15, 23, 42, 0.05)',
        padding: '4px',
        borderRadius: '12px',
        gap: '4px',
        width: 'fit-content',
        position: 'relative',
        border: '1px solid var(--color-border-light)',
        alignSelf: 'flex-start',
        marginBottom: '1.5rem',
        maxWidth: '100%',
        overflowX: 'auto'
      }}>
        {/* Sliding Pill Background Indicator */}
        <div style={{
          position: 'absolute',
          top: '4px',
          bottom: '4px',
          width: '130px',
          borderRadius: '10px',
          background: 'var(--color-surface)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: `translateX(${activeSubTab === 'projects' ? '0px' : '134px'})`,
          zIndex: 1
        }} />

        {[
          { id: 'projects', label: 'Dự án' },
          { id: 'campaigns', label: 'Chiến dịch' }
        ].map(tab => {
          const isSelected = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              style={{
                width: '130px',
                height: '38px',
                borderRadius: '10px',
                border: 'none',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: 'transparent',
                color: isSelected ? 'var(--color-primary)' : 'var(--color-text-light)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                zIndex: 2,
                transition: 'color 0.25s ease'
              }}
              className=""
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels with Enter Animation */}
      <div key={activeSubTab} className="subtab-enter-active" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
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
          <>
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
                          <h3 style={{ fontSize: '0.925rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, lineHeight: 1.3 }}>{proj.name}</h3>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                            <span className="text-xs text-gray-500 font-mono">Mã: {proj.code}</span>
                            {proj.developer && <span className="text-xs text-gray-500">Chủ đầu tư: <strong>{proj.developer}</strong></span>}
                            {proj.location && <span className="text-xs text-gray-500">Vị trí: <strong>{proj.location}</strong></span>}
                          </div>
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '0.675rem',
                          padding: '2px 8px',
                          borderRadius: '100px',
                          fontWeight: 700,
                          background: proj.status === 'active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: proj.status === 'active' ? '#10b981' : '#ef4444',
                          border: proj.status === 'active' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}
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
                        <FileText size={12} /> {(proj.doc_count || 0) + parseIds(proj.document_ids).length} tài liệu
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
                                    target="_blank"
                                    rel="noopener noreferrer"
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
                        {canEditDeleteProject(proj) && (
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
                        )}
                        {canEditDeleteProject(proj) && (
                          <button
                            onClick={() => handleDeleteProject(proj.id)}
                            className="btn secondary sm"
                            style={{ color: 'var(--color-danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                            title="Xóa"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
              <Pagination
                total={totalProjects}
                page={projectPage}
                pageSize={projectPageSize}
                onChange={setProjectPage}
              />
            </div>
          </>
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
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
              {campaigns.map(camp => {
                const associatedProjs = projects.filter(p => {
                  const campIds = p.campaign_ids ? p.campaign_ids.split(',').map((id: string) => id.trim()) : [];
                  return campIds.includes(camp.name);
                });
                const docCount = parseIds(camp.document_ids).length;
                const staffCount = parseIds(camp.user_ids).length;

                return (
                  <div 
                    key={camp.id} 
                    onClick={() => handleOpenCampaignView(camp)}
                    style={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '16px',
                      padding: '1.5rem',
                      cursor: 'pointer',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: 'var(--shadow-sm)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--color-primary)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--color-border-light)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                    }}
                  >
                    <div>
                      {/* Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '12px', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(163, 20, 34, 0.06)', border: '1px solid rgba(163, 20, 34, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Layers size={18} color="var(--color-primary)" />
                          </div>
                          <div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }} className="line-clamp-1">{camp.name}</h3>
                            <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginTop: '2px' }}>ID: {camp.id}</span>
                          </div>
                        </div>
                        <span 
                          className={`badge ${camp.status === 'active' ? 'success' : 'secondary'}`} 
                          style={{ fontSize: '0.7rem', padding: '4px 8px', borderRadius: '100px', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}
                        >
                          {camp.status === 'active' ? 'Hoạt động' : 'Tạm dừng'}
                        </span>
                      </div>

                      {/* Description */}
                      {camp.description ? (
                        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem', lineHeight: 1.4 }} className="line-clamp-2">
                          {camp.description}
                        </p>
                      ) : (
                        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', fontStyle: 'italic', marginBottom: '1.25rem' }}>
                          Không có mô tả chi tiết
                        </p>
                      )}

                      {/* Associated project name tags preview */}
                      {associatedProjs.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '1.25rem' }}>
                          {associatedProjs.map(p => (
                            <span key={p.id} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', color: 'var(--color-text)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600 }}>
                              {p.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Footer Stats Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border-light)', paddingTop: '0.75rem', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <span><strong>{associatedProjs.length}</strong> Dự án</span>
                        <span>•</span>
                        <span><strong>{docCount}</strong> Tài liệu</span>
                        <span>•</span>
                        <span><strong>{staffCount}</strong> Nhân sự</span>
                      </div>
                      {isAdmin && (
                        <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setEditingCampaign(camp);
                              setCampaignModalMode('edit');
                              setIsCampaignModalOpen(true);
                            }}
                            className="btn outline icon-only sm"
                            title="Sửa"
                          >
                            <Edit size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteCampaign(camp.id)}
                            className="btn outline icon-only sm"
                            style={{ color: 'var(--color-danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                            title="Xóa"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
              <Pagination
                total={totalCampaigns}
                page={campaignPage}
                pageSize={campaignPageSize}
                onChange={setCampaignPage}
              />
            </div>
          </>
        )
      )}
      </div>

      {/* Edit Modal */}
      <CustomModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={projectModalMode === 'view' 
          ? `Chi tiết Dự án: ${editingProject?.name}` 
          : editingProject?.id ? 'Chỉnh sửa dự án' : 'Thêm dự án mới'}
        width="850px"
      >
        {projectModalMode === 'view' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Tên dự án</span>
                <span style={{ color: 'var(--color-text)', fontSize: '0.925rem', fontWeight: 700, display: 'block' }}>{editingProject?.name}</span>
              </div>
              <div>
                <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Mã dự án</span>
                <span style={{ color: 'var(--color-text)', fontSize: '0.925rem', fontWeight: 700, display: 'block', fontFamily: 'monospace' }}>{editingProject?.code}</span>
              </div>
              <div>
                <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Chủ đầu tư</span>
                <span style={{ color: 'var(--color-text)', fontSize: '0.925rem', fontWeight: 600, display: 'block' }}>{editingProject?.developer || 'Chưa cập nhật'}</span>
              </div>
              <div>
                <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Trạng thái bán</span>
                <span 
                  className={`badge ${editingProject?.status === 'active' ? 'success' : 'secondary'}`}
                  style={{ fontSize: '0.7rem', padding: '4px 8px', borderRadius: '100px', fontWeight: 700, display: 'inline-block', marginTop: '2px' }}
                >
                  {editingProject?.status === 'active' ? 'Đang mở bán' : 'Tạm dừng bán'}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Vị trí / Địa chỉ</span>
                <span style={{ color: 'var(--color-text)', fontSize: '0.925rem', fontWeight: 600, display: 'block' }}>{editingProject?.location || 'Chưa cập nhật'}</span>
              </div>
              <div>
                <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Trạng thái thi công & Tiến độ</span>
                <span style={{ color: 'var(--color-text)', fontSize: '0.925rem', fontWeight: 600, display: 'block' }}>
                  {editingProject?.construction_status || 'Chưa khởi công'} ({editingProject?.progress_percent ?? 0}%)
                </span>
              </div>
              <div>
                <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Trạng thái pháp lý</span>
                <span style={{ color: 'var(--color-text)', fontSize: '0.925rem', fontWeight: 600, display: 'block' }}>{editingProject?.legal_status || 'Đang hoàn thiện pháp lý'}</span>
              </div>
              <div>
                <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Năm bàn giao dự kiến</span>
                <span style={{ color: 'var(--color-text)', fontSize: '0.925rem', fontWeight: 600, display: 'block' }}>{editingProject?.handover_year || 2026}</span>
              </div>
              <div>
                <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Quy mô Block & Căn hộ</span>
                <span style={{ color: 'var(--color-text)', fontSize: '0.925rem', fontWeight: 600, display: 'block' }}>
                  {editingProject?.scale_block_count || 1} Block, {editingProject?.scale_unit_count || 100} căn hộ
                </span>
              </div>
              <div>
                <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Đường dẫn Folder</span>
                <span style={{ color: 'var(--color-text)', fontSize: '0.925rem', fontWeight: 600, wordBreak: 'break-all', display: 'block' }}>
                  {editingProject?.folder_path || 'Không có folder liên kết'}
                </span>
              </div>
            </div>

            <div style={{ borderBottom: '1px solid var(--color-border-light)', paddingBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>Manager phụ trách chính</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {parseIds(editingProject?.manager_ids).length === 0 ? (
                  <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>Chưa phân công manager phụ trách</span>
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
              <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>Tài liệu mật liên kết</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {parseIds(editingProject?.document_ids).length === 0 ? (
                  <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>Chưa liên kết tài liệu mật</span>
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
                        style={{ color: 'var(--color-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600 }}
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
              <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Mô tả chi tiết</span>
              <p style={{ color: 'var(--color-text)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5, fontSize: '0.875rem' }}>
                {editingProject?.description || 'Không có mô tả chi tiết'}
              </p>
            </div>
            
            <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem', marginTop: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn primary sm" style={{ borderRadius: '100px' }} onClick={() => setIsEditModalOpen(false)}>Đóng</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveProject} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
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
            
            <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn outline sm" style={{ borderRadius: '100px' }} onClick={() => setIsEditModalOpen(false)}>Hủy</button>
              <button type="submit" className="btn primary sm" style={{ borderRadius: '100px' }}>Lưu dự án</button>
            </div>
          </form>
        )}
      </CustomModal>

      {/* Roster Modal */}
      <CustomModal
        isOpen={isRosterModalOpen}
        onClose={() => setIsRosterModalOpen(false)}
        title="Cấu hình Roster Nhân Sự Phân Phối"
        width="650px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '55vh', overflowY: 'auto', paddingRight: '4px' }}>
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
          <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" className="btn outline sm" style={{ borderRadius: '100px' }} onClick={() => setIsRosterModalOpen(false)}>Hủy</button>
            <button type="button" className="btn primary sm" style={{ borderRadius: '100px' }} onClick={handleSaveRoster}>Lưu thay đổi</button>
          </div>
        </div>
      </CustomModal>

      <CustomModal
        isOpen={isDocsModalOpen}
        onClose={() => setIsDocsModalOpen(false)}
        title="Kho Tài Liệu Dự Án (Mật)"
        width="700px"
      >
        {(() => {
          const selectedProj = projects.find(p => p.id === selectedProjectId);
          const linkedDocIds = selectedProj?.document_ids ? parseIds(selectedProj.document_ids) : [];
          
          const formattedLinkedDocs = allFiles
            .filter(f => linkedDocIds.includes(String(f.id)))
            .map(f => ({
              id: f.id,
              name: f.name,
              file_path: f.file_path,
              file_size: Number(f.file_size || 0),
              mime_type: f.mime_type || '',
              uploaded_by_name: f.uploaded_by_name || 'Hệ thống',
              created_at: f.created_at || new Date().toISOString(),
              isLinkedOnly: true
            }));

          const combinedDocs = [...projectDocs, ...formattedLinkedDocs];

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '50vh', overflowY: 'auto', paddingRight: '4px' }}>
                {combinedDocs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--color-text-muted)' }}>Chưa có tài liệu nào cho dự án này</div>
                ) : (
                  combinedDocs.map(doc => (
                    <div
                      key={`${doc.isLinkedOnly ? 'link' : 'direct'}-${doc.id}`}
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatFileName(doc.name, 35)}</h4>
                          {doc.isLinkedOnly && (
                            <span style={{ fontSize: '0.625rem', padding: '2px 8px', borderRadius: '100px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                              Thư viện
                            </span>
                          )}
                        </div>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                          {doc.uploaded_by_name} • {(doc.file_size / 1024 / 1024).toFixed(2)} MB • {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => {
                            if (doc.isLinkedOnly) {
                              const url = `${import.meta.env.VITE_API_URL || '/backend'}/${doc.file_path}`;
                              window.open(url, '_blank');
                            } else {
                              handleDownloadDoc(doc.id);
                            }
                          }}
                          className="btn secondary sm"
                          style={{ minWidth: 'auto', padding: '0 0.5rem' }}
                          title="Tải xuống / Mở"
                        >
                          <Download size={14} />
                        </button>
                        {isAdmin && !doc.isLinkedOnly && (
                          <button
                            onClick={() => handleDeleteDoc(doc.id)}
                            className="btn danger sm"
                            style={{ minWidth: 'auto', padding: '0 0.5rem', backgroundColor: 'var(--color-red-light)', borderColor: 'var(--color-red-light)', color: 'var(--color-red)' }}
                            title="Xóa"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="btn primary sm" style={{ borderRadius: '100px' }} onClick={() => setIsDocsModalOpen(false)}>Đóng</button>
              </div>
            </div>
          );
        })()}
      </CustomModal>

      {/* Campaign Create/Edit Modal */}
      <CustomModal
        isOpen={isCampaignModalOpen}
        onClose={() => setIsCampaignModalOpen(false)}
        title={campaignModalMode === 'view' 
          ? `Chi tiết Chiến dịch: ${editingCampaign?.name}` 
          : editingCampaign?.id ? 'Chỉnh sửa Chiến dịch' : 'Thêm Chiến dịch mới'}
        width="850px"
      >
        {campaignModalMode === 'view' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Tên chiến dịch</span>
                <span style={{ color: 'var(--color-text)', fontSize: '0.925rem', fontWeight: 700, display: 'block' }}>{editingCampaign?.name}</span>
              </div>
              <div>
                <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Trạng thái hoạt động</span>
                <span 
                  className={`badge ${editingCampaign?.status === 'active' ? 'success' : 'secondary'}`}
                  style={{ fontSize: '0.7rem', padding: '4px 8px', borderRadius: '100px', fontWeight: 700, display: 'inline-block', marginTop: '2px' }}
                >
                  {editingCampaign?.status === 'active' ? 'Hoạt động' : 'Tạm dừng'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Ngày bắt đầu</span>
                <span style={{ color: 'var(--color-text)', fontSize: '0.925rem', fontWeight: 600, display: 'block' }}>{editingCampaign?.start_date || 'Chưa thiết lập'}</span>
              </div>
              <div>
                <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Ngày kết thúc</span>
                <span style={{ color: 'var(--color-text)', fontSize: '0.925rem', fontWeight: 600, display: 'block' }}>{editingCampaign?.end_date || 'Chưa thiết lập'}</span>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Đường dẫn Folder</span>
                <span style={{ color: 'var(--color-text)', fontSize: '0.925rem', fontWeight: 600, wordBreak: 'break-all', display: 'block' }}>
                  {editingCampaign?.folder_path || 'Không có folder liên kết'}
                </span>
              </div>
            </div>

            <div style={{ borderBottom: '1px solid var(--color-border-light)', paddingBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '10px' }}>
                Các Dự án liên kết &amp; Nhân sự phụ trách
              </span>
              
              {(() => {
                const associatedProjs = projects.filter(p => {
                  const campIds = p.campaign_ids ? p.campaign_ids.split(',').map((id: string) => id.trim()) : [];
                  return campIds.includes(editingCampaign?.name);
                });

                if (associatedProjs.length === 0) {
                  return (
                    <div style={{ padding: '1rem', background: 'var(--color-bg)', border: '1px dashed var(--color-border)', borderRadius: '12px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                      Chưa liên kết dự án nào
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {associatedProjs.map(proj => {
                      const docIds = proj.document_ids ? proj.document_ids.split(',').map((id: string) => id.trim()) : [];
                      const projDocs = allFiles.filter(f => docIds.includes(String(f.id)));
                      const rosterList = campaignRosters[proj.id] || [];

                      return (
                        <div key={proj.id} style={{ border: '1px solid var(--color-border-light)', borderRadius: '12px', padding: '1rem', background: 'var(--color-bg)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px dotted var(--color-border-light)', paddingBottom: '0.5rem' }}>
                            <span 
                              onClick={() => {
                                setEditingProject(proj);
                                setProjectModalMode('view');
                                setIsCampaignModalOpen(false);
                                setIsEditModalOpen(true);
                              }}
                              style={{ color: 'var(--color-primary)', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Building2 size={14} /> {proj.name}
                            </span>
                            <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>{proj.code}</span>
                          </div>

                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                            Thư mục liên kết: <strong style={{ color: 'var(--color-text)' }}>{proj.folder_path || 'Không có folder liên kết'}</strong>
                          </div>

                          <div style={{ marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Tài liệu mật liên kết:</span>
                            {projDocs.length === 0 ? (
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontStyle: 'italic' }}>Không có tài liệu liên kết</span>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {projDocs.map(doc => (
                                  <a
                                    key={doc.id}
                                    href={`${import.meta.env.VITE_API_URL ?? '/backend'}/${doc.file_path}`}
                                    download={doc.name}
                                    style={{ color: 'var(--color-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600 }}
                                    onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                                    onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                                  >
                                    <FileText size={12} /> {doc.name}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>

                          <div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Nhân sự phân phối phụ trách:</span>
                            {campaignRostersLoading ? (
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>Đang tải roster...</span>
                            ) : rosterList.length === 0 ? (
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontStyle: 'italic' }}>Chưa phân công nhân sự</span>
                            ) : (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {rosterList.map(member => (
                                  <span key={member.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '2px 8px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text)' }}>
                                    {member.full_name || member.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Description */}
            <div>
              <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Mô tả chiến dịch</span>
              <p style={{ color: 'var(--color-text)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5, fontSize: '0.875rem' }}>
                {editingCampaign?.description || 'Không có mô tả chi tiết'}
              </p>
            </div>

            {/* Close Button */}
            <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn primary sm" style={{ borderRadius: '100px' }} onClick={() => setIsCampaignModalOpen(false)}>Đóng</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveCampaign} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Tên Chiến dịch <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ví dụ: Facebook Lead Ads - HCMC"
                  value={editingCampaign?.name || ''}
                  onChange={e => setEditingCampaign({ ...editingCampaign, name: e.target.value })}
                  required
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

            <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn outline sm" style={{ borderRadius: '100px' }} onClick={() => setIsCampaignModalOpen(false)}>Hủy</button>
              <button type="submit" className="btn primary sm" style={{ borderRadius: '100px' }}>Lưu lại</button>
            </div>
          </form>
        )}
      </CustomModal>
    </div>
  );
}
