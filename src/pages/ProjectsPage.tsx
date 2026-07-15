import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { fetchAPI } from '../utils/api';
import api from '../api/axios';
import { useAuth } from '../contexts/AuthContext';
import { useUIStore } from '../store/uiStore';
import { Building2, Users, FileText, Plus, Trash2, Edit, X, Upload, Download, Check, AlertCircle, Layers, FileSpreadsheet, Link2, Globe, Search, Folder, ExternalLink, MessageSquare, Paperclip, RefreshCw, Calendar, CheckSquare, HardDrive, Info } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { EmptyCard } from '../components/ui/EmptyCard';
import { compressToWebP } from '../utils/imageCompress';
import { CustomSelect } from '../components/ui/CustomSelect';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { AddressSelect } from '../components/ui/AddressSelect';
import { CustomModal } from '../components/ui/CustomModal';
import { Pagination } from '../components/ui/Pagination';
import { Skeleton } from '../components/ui/Skeleton';
import { Avatar } from '../components/ui/Avatar';
import { MentionInput } from '../components/ui/MentionInput';



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
  reference_url?: string;
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

const ProjectCardSkeleton = () => (
  <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid var(--color-border-light)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <Skeleton width="70%" height={20} />
      <Skeleton width={60} height={20} borderRadius={10} />
    </div>
    <Skeleton width={120} height={12} style={{ marginTop: '4px' }} />
    <Skeleton width="100%" height={14} style={{ marginTop: '4px' }} />
    <div style={{ height: '1px', background: 'var(--color-border-light)', margin: '4px 0' }} />
    <div style={{ display: 'flex', gap: '8px' }}>
      <Skeleton width="45%" height={24} borderRadius={4} />
      <Skeleton width="45%" height={24} borderRadius={4} />
    </div>
    <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
      <Skeleton width={80} height={12} />
      <Skeleton width={80} height={12} />
    </div>
    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
      <Skeleton width="50%" height={32} borderRadius={16} />
      <Skeleton width="50%" height={32} borderRadius={16} />
    </div>
  </div>
);

const CampaignCardSkeleton = () => (
  <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid var(--color-border-light)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <Skeleton width="60%" height={18} />
      <Skeleton width={80} height={22} borderRadius={20} />
    </div>
    <Skeleton width="100%" height={14} style={{ marginTop: '4px' }} />
    <div style={{ display: 'flex', gap: '12px' }}>
      <Skeleton width={70} height={12} />
      <Skeleton width={70} height={12} />
    </div>
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      <Skeleton width={32} height={32} borderRadius="50%" />
      <Skeleton width={32} height={32} borderRadius="50%" />
      <Skeleton width={32} height={32} borderRadius="50%" />
    </div>
    <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem' }}>
      <Skeleton width="50%" height={32} borderRadius={6} />
      <Skeleton width="50%" height={32} borderRadius={6} />
    </div>
  </div>
);

export default function ProjectsPage() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { user } = useAuth();
  const { addToast, showConfirm } = useUIStore();
  const { t } = useLanguage();
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fileCategories, setFileCategories] = useState<{ id: number; label: string }[]>([]);
  const [folderLinkType, setFolderLinkType] = useState<'link' | 'select'>('link');
  const [campaignFolderLinkType, setCampaignFolderLinkType] = useState<'link' | 'select'>('link');
  const isLegacyLayoutEnabled = false;

  useEffect(() => {
    api.get('/file-categories')
      .then(res => {
        if (res.data && Array.isArray(res.data.data)) {
          setFileCategories(res.data.data);
        }
      })
      .catch(err => console.error('Failed to fetch file categories', err));
  }, []);
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
  const [rosterSearch, setRosterSearch] = useState('');

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Partial<Project> | null>(null);
  const [autoCode, setAutoCode] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'campaigns') {
      setActiveSubTab('campaigns');
    } else {
      setActiveSubTab('projects');
    }

    const targetId = params.get('id') || params.get('project_id');
    if (targetId && projects.length > 0) {
      const matched = projects.find(p => String(p.id) === targetId);
      if (matched) {
        setEditingProject(matched);
        setProjectModalMode('view');
        setIsEditModalOpen(true);

        // clean url parameters
        const newParams = new URLSearchParams(window.location.search);
        newParams.delete('id');
        newParams.delete('project_id');
        const cleanUrl = window.location.pathname + (newParams.toString() ? '?' + newParams.toString() : '');
        window.history.replaceState({}, '', cleanUrl);
      }
    }
  }, [window.location.search, projects]);

  const [projectPage, setProjectPage] = useState(1);
  const [projectPageSize, setProjectPageSize] = useState(12);
  const [campaignPage, setCampaignPage] = useState(1);
  const [campaignPageSize, setCampaignPageSize] = useState(12);

  const quickUploadInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingProject) {
      const isUrl = editingProject.folder_path?.startsWith('http') || false;
      setFolderLinkType(isUrl ? 'link' : 'select');
    }
  }, [editingProject?.id]);

  useEffect(() => {
    if (editingCampaign) {
      const isUrl = editingCampaign.folder_path?.startsWith('http') || false;
      setCampaignFolderLinkType(isUrl ? 'link' : 'select');
    }
  }, [editingCampaign?.id]);

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

  const [projectRoster, setProjectRoster] = useState<any[]>([]);
  const [projectRosterLoading, setProjectRosterLoading] = useState(false);
  const [projectDrawerTab, setProjectDrawerTab] = useState<'details' | 'changelog'>('details');
  const [campaignDrawerTab, setCampaignDrawerTab] = useState<'details' | 'changelog'>('details');
  const [projectStats, setProjectStats] = useState<any>(null);
  const [campaignStats, setCampaignStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const loadProjectStats = async (id: number) => {
    setStatsLoading(true);
    try {
      const res = await fetchAPI(`projects/${id}/stats`);
      if (res && res.success) {
        setProjectStats(res.data);
      } else {
        setProjectStats(null);
      }
    } catch (e) {
      console.error(e);
      setProjectStats(null);
    } finally {
      setStatsLoading(false);
    }
  };

  const loadCampaignStats = async (id: number) => {
    setStatsLoading(true);
    try {
      const res = await fetchAPI(`campaigns/${id}/stats`);
      if (res && res.success) {
        setCampaignStats(res.data);
      } else {
        setCampaignStats(null);
      }
    } catch (e) {
      console.error(e);
      setCampaignStats(null);
    } finally {
      setStatsLoading(false);
    }
  };

  const loadProjectRoster = async (projectId: number) => {
    setProjectRosterLoading(true);
    try {
      const res = await fetchAPI(`projects/${projectId}/roster`);
      if (Array.isArray(res)) {
        setProjectRoster(res.filter((m: any) => m.is_assigned === 1));
      } else if (res.success && Array.isArray(res.data)) {
        setProjectRoster(res.data.filter((m: any) => m.is_assigned === 1));
      } else {
        setProjectRoster([]);
      }
    } catch (e) {
      console.error(e);
      setProjectRoster([]);
    } finally {
      setProjectRosterLoading(false);
    }
  };

  // Comments state for Project or Campaign Detail Modals
  const [detailComments, setDetailComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Linked Tasks state for Project or Campaign Detail Modals
  const [linkedTasks, setLinkedTasks] = useState<any[]>([]);
  const [loadingLinkedTasks, setLoadingLinkedTasks] = useState(false);

  const loadDetailComments = async (entityType: 'project' | 'campaign', entityId: number) => {
    setLoadingComments(true);
    try {
      const res = await fetchAPI(`${entityType}s/${entityId}/comments`);
      if (Array.isArray(res)) {
        setDetailComments(res);
      } else if (res.success && Array.isArray(res.data)) {
        setDetailComments(res.data);
      } else {
        setDetailComments([]);
      }
    } catch (e) {
      console.error(e);
      setDetailComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  const handlePostDetailComment = async (entityType: 'project' | 'campaign', entityId: number) => {
    if (!newCommentText.trim() || isSubmittingComment) return;
    setIsSubmittingComment(true);
    try {
      const res = await fetchAPI(`${entityType}s/${entityId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: newCommentText.trim() }),
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.success || res.id) {
        setNewCommentText('');
        loadDetailComments(entityType, entityId);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const loadLinkedTasks = async (entityType: 'project' | 'campaign', entityId: number) => {
    setLoadingLinkedTasks(true);
    try {
      const res = await fetchAPI(`activities?related_type=${entityType}&related_id=${entityId}&limit=100`);
      if (res && res.items) {
        setLinkedTasks(res.items);
      } else if (res.success && res.data && Array.isArray(res.data.items)) {
        setLinkedTasks(res.data.items);
      } else if (res.data && Array.isArray(res.data)) {
        setLinkedTasks(res.data);
      } else {
        setLinkedTasks([]);
      }
    } catch (e) {
      console.error(e);
      setLinkedTasks([]);
    } finally {
      setLoadingLinkedTasks(false);
    }
  };

  useEffect(() => {
    if (editingProject && editingProject.id) {
      loadProjectRoster(editingProject.id);
      loadDetailComments('project', editingProject.id);
      loadLinkedTasks('project', editingProject.id);
      loadProjectStats(editingProject.id);
    } else {
      setProjectRoster([]);
      setDetailComments([]);
      setLinkedTasks([]);
      setProjectStats(null);
    }
  }, [editingProject?.id]);

  useEffect(() => {
    if (editingCampaign && editingCampaign.id) {
      loadDetailComments('campaign', editingCampaign.id);
      loadLinkedTasks('campaign', editingCampaign.id);
      loadCampaignStats(editingCampaign.id);
    } else {
      setCampaignStats(null);
      if (!editingProject) {
        setDetailComments([]);
        setLinkedTasks([]);
      }
    }
  }, [editingCampaign?.id]);

  const renderDrawer = (isOpen: boolean, onClose: () => void, title: string, content: React.ReactNode, width: string = '850px', headerActions?: React.ReactNode) => {
    if (!isOpen) return null;
    return createPortal(
      <>
        <div 
          className="drawer-backdrop"
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            zIndex: 10000,
            backdropFilter: 'blur(4px)',
            transition: 'all 0.3s ease',
            cursor: 'pointer'
          }}
        />
        <div 
          className="drawer-sheet"
          style={{
            left: window.innerWidth <= 768 ? 0 : 'var(--sidebar-width, 220px)',
            right: 0,
            maxWidth: '100vw',
            zIndex: 10600,
            background: 'linear-gradient(180deg, var(--color-bg) 0%, var(--color-border-light) 100%)',
            display: 'flex',
            flexDirection: 'column',
            position: 'fixed',
            top: 0,
            bottom: 0,
            boxShadow: '-10px 0 30px rgba(0,0,0,0.15)',
            animation: 'slideInProj 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            willChange: 'transform'
          }}
        >
          {/* Drawer Header */}
          <div style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--color-border-light)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#ffffff',
            position: 'sticky',
            top: 0,
            zIndex: 10
          }}>
            <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800, color: 'var(--color-text)' }}>{title}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {headerActions}
              <button 
                onClick={onClose} 
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', borderRadius: '50%' }}
                className="hover-lift"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          {/* Drawer Content */}
          <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }} className="custom-scrollbar">
            {content}
          </div>
        </div>
        <style>{`
          @keyframes slideInProj {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}</style>
      </>,
      document.body
    );
  };

  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
  const [projectDocs, setProjectDocs] = useState<ProjectDoc[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [editingDocKey, setEditingDocKey] = useState<string | null>(null);
  const [editDocNameVal, setEditDocNameVal] = useState<string>('');

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

  const isAdmin = user && ['admin', 'superadmin', 'super_admin', 'director', 'assistant'].includes(user.role);
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

  const renderFolderPathLink = (path: string | undefined, projectId?: number) => {
    if (!path) return <span style={{ color: 'var(--color-text-light)', fontStyle: 'italic' }}>Không có folder liên kết</span>;
    const isUrl = path.startsWith('http://') || path.startsWith('https://');
    if (isUrl) {
      return (
        <a 
          href={path} 
          target="_blank" 
          rel="noopener noreferrer" 
          style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <HardDrive size={14} />
          <span>Mở Google Drive</span>
        </a>
      );
    }
    
    const linkUrl = projectId ? `/files?project_id=${projectId}` : '/files';
    return (
      <a 
        href={linkUrl} 
        target="_blank" 
        rel="noopener noreferrer" 
        style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
      >
        <Folder size={14} />
        <span>{path} (Xem trong Kho tài liệu)</span>
      </a>
    );
  };

  const renderProjectViewDrawer = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border-light)', gap: '1.5rem', marginBottom: '0.25rem' }}>
          <button
            onClick={() => setProjectDrawerTab('details')}
            style={{
              padding: '8px 4px 12px',
              background: 'none',
              border: 'none',
              borderBottom: projectDrawerTab === 'details' ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: projectDrawerTab === 'details' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Thông tin & Chỉ số
          </button>
          <button
            onClick={() => setProjectDrawerTab('changelog')}
            style={{
              padding: '8px 4px 12px',
              background: 'none',
              border: 'none',
              borderBottom: projectDrawerTab === 'changelog' ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: projectDrawerTab === 'changelog' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Lịch sử thay đổi
          </button>
        </div>

        {projectDrawerTab === 'details' ? (
          <>
            {/* KPI Summary Cards */}
            {projectStats && (
              <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', minHeight: '100px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tổng Giao dịch</span>
                    <div className="stat-icon" style={{ color: 'var(--color-primary)', opacity: 0.8 }}><Layers size={18} /></div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div className="stat-value" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>
                      {projectStats.total_deals}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 2, fontWeight: 500 }}>Cơ hội bán hàng</div>
                  </div>
                </div>

                <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', minHeight: '100px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Doanh thu thực tế</span>
                    <div className="stat-icon" style={{ color: '#10b981', opacity: 0.8 }}><CheckSquare size={18} /></div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div className="stat-value" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={projectStats.actual_revenue.toLocaleString('vi-VN') + ' VND'}>
                      {projectStats.actual_revenue >= 1000000000 
                        ? `${(projectStats.actual_revenue / 1000000000).toFixed(2)} tỷ` 
                        : `${(projectStats.actual_revenue / 1000000).toFixed(0)} triệu`}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 2, fontWeight: 500 }}>Từ hóa đơn đã thu</div>
                  </div>
                </div>

                <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', minHeight: '100px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tỷ lệ chốt</span>
                    <div className="stat-icon" style={{ color: '#f59e0b', opacity: 0.8 }}><Users size={18} /></div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div className="stat-value" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>
                      {projectStats.win_rate}%
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 2, fontWeight: 500 }}>Tỷ lệ giao dịch thành công</div>
                  </div>
                </div>

                <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', minHeight: '100px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Đang chăm sóc</span>
                    <div className="stat-icon" style={{ color: '#6366f1', opacity: 0.8 }}><Building2 size={18} /></div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div className="stat-value" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>
                      {projectStats.total_leads}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 2, fontWeight: 500 }}>Khách hàng tiềm năng</div>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '1.5rem', alignItems: 'start' }}>
              {/* Left Column (3/5) */}
              <div style={{ flex: 3, width: isMobile ? '100%' : 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* Section 1: Thông tin cơ bản */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '3px', height: '14px', background: 'var(--color-primary)', borderRadius: '1.5px', flexShrink: 0 }} />
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Thông tin cơ bản</h4>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
                    <div>
                      <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Tên dự án</span>
                      <span style={{ color: 'var(--color-text)', fontSize: '0.925rem', fontWeight: 700, display: 'block' }}>{editingProject?.name}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Mã dự án</span>
                      <span style={{ color: 'var(--color-text)', fontSize: '0.925rem', fontWeight: 700, display: 'block', fontFamily: 'monospace' }}>{editingProject?.code}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Chủ đầu tư</span>
                      <span style={{ color: 'var(--color-text)', fontSize: '0.925rem', fontWeight: 700, display: 'block' }}>{editingProject?.developer || 'Chưa cập nhật'}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Trạng thái bán</span>
                      <span 
                        className={`badge ${editingProject?.status === 'active' ? 'success' : 'secondary'}`}
                        style={{ fontSize: '0.75rem', padding: '5px 10px', borderRadius: '100px', fontWeight: 700, display: 'inline-block', marginTop: '2px' }}
                      >
                        {editingProject?.status === 'active' ? 'Đang mở bán' : 'Tạm dừng bán'}
                      </span>
                    </div>
                    {editingProject?.reference_url && (
                      <div style={{ gridColumn: 'span 2', marginTop: '4px', borderTop: '1px dotted var(--color-border-light)', paddingTop: '8px' }}>
                        <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Website / Link tham khảo</span>
                        <a
                          href={editingProject.reference_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: 'var(--color-primary)',
                            textDecoration: 'none',
                            fontWeight: 700,
                            fontSize: '0.875rem'
                          }}
                        >
                          {editingProject.reference_url.includes('docs.google.com/spreadsheets') || editingProject.reference_url.includes('google.com/sheets') ? (
                            <>
                              <FileSpreadsheet size={16} color="#10b981" />
                              <span style={{ color: '#10b981' }}>Bảng tính Google Sheets</span>
                            </>
                          ) : (
                            <>
                              <Link2 size={16} />
                              <span>Mở liên kết tham khảo</span>
                            </>
                          )}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 2: Vị trí & Quy mô & Pháp lý */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '3px', height: '14px', background: 'var(--color-primary)', borderRadius: '1.5px', flexShrink: 0 }} />
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vị trí, Quy mô & Pháp lý</h4>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
                    <div>
                      <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Vị trí / Địa chỉ</span>
                      <span style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 600, display: 'block' }}>{editingProject?.location || 'Chưa cập nhật'}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Trạng thái thi công &amp; Tiến độ</span>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 600 }}>
                          {editingProject?.construction_status || 'Chưa khởi công'}
                        </span>
                        <span style={{ fontSize: '0.875rem', fontWeight: 800, color: (editingProject?.progress_percent ?? 0) === 100 ? 'var(--color-success)' : 'var(--color-primary)' }}>
                          {editingProject?.progress_percent ?? 0}%
                        </span>
                      </div>
                      
                      {/* Beautiful progress bar */}
                      <div style={{ height: '10px', background: 'var(--color-border-light)', borderRadius: '99px', overflow: 'hidden', marginTop: '4px', width: '100%' }}>
                        <div 
                          style={{ 
                            height: '100%', 
                            width: `${editingProject?.progress_percent ?? 0}%`, 
                            background: (editingProject?.progress_percent ?? 0) === 100 ? 'var(--color-success)' : 'linear-gradient(90deg, #BD1D2D, #F97316)',
                            borderRadius: '99px',
                            transition: 'width 0.4s var(--transition-fluid)'
                          }} 
                        />
                      </div>

                      {/* Milestone Timeline */}
                      <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 750 }}>Cột mốc dự án (Milestones)</span>
                        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', padding: '8px 0 24px' }}>
                          {/* Connecting Line */}
                          <div style={{ position: 'absolute', top: '23px', left: '10px', right: '10px', height: '2px', background: 'var(--color-border-light)', zIndex: 1 }} />
                          <div 
                            style={{ 
                              position: 'absolute', 
                              top: '23px', 
                              left: '10px', 
                              width: `${Math.min(100, Math.max(0, ((editingProject?.progress_percent ?? 0) / 100) * 100))}%`, 
                              height: '2px', 
                              background: 'var(--color-primary)', 
                              zIndex: 2,
                              transition: 'width 0.3s ease'
                            }} 
                          />
                          
                          {/* Milestone Nodes */}
                          {[
                            { name: 'Chuẩn bị', pct: 10, label: 'Khởi công' },
                            { name: 'Phần móng', pct: 30, label: 'Xây móng' },
                            { name: 'Phần thô', pct: 60, label: 'Xây thô' },
                            { name: 'Cất nóc', pct: 85, label: 'Cất nóc' },
                            { name: 'Bàn giao', pct: 100, label: 'Bàn giao' }
                          ].map((milestone, idx) => {
                            const isDone = (editingProject?.progress_percent ?? 0) >= milestone.pct;
                            const isCurrent = (editingProject?.progress_percent ?? 0) === milestone.pct;
                            return (
                              <div 
                                key={idx}
                                style={{ 
                                  display: 'flex', 
                                  flexDirection: 'column', 
                                  alignItems: 'center', 
                                  zIndex: 3, 
                                  position: 'relative'
                                }}
                              >
                                <div style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  background: isDone ? 'var(--color-primary)' : '#ffffff',
                                  border: isDone ? '2px solid var(--color-primary)' : '2px solid var(--color-border-light)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: isDone ? '#ffffff' : 'var(--color-text-muted)',
                                  fontWeight: 800,
                                  fontSize: '0.75rem',
                                  boxShadow: isCurrent ? '0 0 0 4px rgba(189, 29, 45, 0.2)' : '0 2px 4px rgba(0,0,0,0.05)',
                                  transition: 'all 0.2s ease',
                                  transform: isCurrent ? 'scale(1.15)' : 'none'
                                }}>
                                  {isDone ? <Check size={14} strokeWidth={3} /> : idx + 1}
                                </div>
                                <span style={{
                                  position: 'absolute',
                                  bottom: '-20px',
                                  fontSize: '0.68rem',
                                  fontWeight: isDone ? 750 : 600,
                                  color: isDone ? 'var(--color-text)' : 'var(--color-text-muted)',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {milestone.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Trạng thái pháp lý</span>
                      <span style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 600, display: 'block' }}>{editingProject?.legal_status || 'Đang hoàn thiện pháp lý'}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Năm bàn giao dự kiến</span>
                      <span style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 600, display: 'block' }}>{editingProject?.handover_year || 2026}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Quy mô Block &amp; Căn hộ</span>
                      <span style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 600, display: 'block' }}>
                        {editingProject?.scale_block_count || 1} Block, {editingProject?.scale_unit_count || 100} căn hộ
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Đường dẫn Folder</span>
                      <div style={{ marginTop: '4px' }}>
                        {renderFolderPathLink(editingProject?.folder_path, editingProject?.id)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 4: Mô tả chi tiết */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block' }}>Mô tả chi tiết</span>
                  <p style={{ color: 'var(--color-text)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5, fontSize: '0.875rem' }}>
                    {editingProject?.description || 'Không có mô tả chi tiết'}
                  </p>
                </div>

                {/* Discussions/Comments */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>
                    Thảo luận & Trao đổi ({detailComments.length})
                  </span>
                  
                  <div style={{ background: 'var(--color-bg-light)', border: '1px solid var(--color-border-light)', padding: '12px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                    <MentionInput
                      users={users}
                      value={newCommentText}
                      onChange={e => setNewCommentText(e.target.value)}
                      placeholder="Viết bình luận... (Gõ @ để nhắc tên đồng nghiệp)"
                      style={{ minHeight: '55px', fontSize: '0.85rem' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--color-border-light)', paddingTop: '8px', marginTop: '2px' }}>
                      <button
                        onClick={() => handlePostDetailComment('project', editingProject!.id!)}
                        disabled={isSubmittingComment}
                        className="btn primary sm"
                        style={{ padding: '5px 16px', fontSize: '0.75rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <MessageSquare size={12} />
                        <span>Gửi bình luận</span>
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }} className="custom-scrollbar">
                    {loadingComments ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
                        <RefreshCw className="spin" size={16} color="var(--color-text-muted)" />
                      </div>
                    ) : detailComments.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.78rem', fontStyle: 'italic' }}>
                        Chưa có thảo luận nào.
                      </div>
                    ) : (
                      detailComments.map((comment: any) => (
                        <div key={comment.id} style={{ display: 'flex', gap: '8px', fontSize: '0.8125rem' }}>
                          <Avatar name={comment.user_name || 'User'} src={comment.avatar_url || undefined} size={24} />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', background: 'var(--color-bg-light)', border: '1px solid var(--color-border-light)', padding: '8px 12px', borderRadius: '12px', flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 800, color: 'var(--color-text)' }}>{comment.user_name || 'Thành viên'}</span>
                              <span style={{ fontSize: '0.65rem', color: 'var(--color-text-light)', fontWeight: 600 }}>
                                {new Date(comment.created_at).toLocaleString('vi-VN')}
                              </span>
                            </div>
                            <p style={{ margin: 0, color: 'var(--color-text)', lineHeight: 1.4 }}>{comment.body}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

              {/* Right Column (2/5) */}
              <div style={{ flex: 2, width: isMobile ? '100%' : 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* Section 3: Nhân sự & Tài liệu */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '3px', height: '14px', background: 'var(--color-primary)', borderRadius: '1.5px', flexShrink: 0 }} />
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quản lý &amp; Tài liệu</h4>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                      <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '6px' }}>Manager phụ trách chính</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {parseIds(editingProject?.manager_ids).length === 0 ? (
                          <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>Chưa phân công manager phụ trách</span>
                        ) : (
                          parseIds(editingProject?.manager_ids).map(id => {
                            const u = users.find(usr => String(usr.id) === String(id));
                            if (!u) return null;
                            return (
                              <span key={id} style={{ background: 'var(--color-bg-light)', border: '1px solid var(--color-border)', padding: '4px 10px', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <Avatar src={u.avatar_url || u.avatar} name={u.full_name || u.fullname || u.username} size={18} />
                                {u.full_name || u.fullname || u.username}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>
                    <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '0.75rem' }}>
                      <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '6px' }}>Đội ngũ nhân sự phụ trách</span>
                      {projectRosterLoading ? (
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Đang tải danh sách nhân sự...</span>
                      ) : projectRoster.length === 0 ? (
                        <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>Chưa phân công nhân sự</span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', padding: '2px 0' }}>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            {projectRoster.slice(0, 5).map((member: any, idx: number) => (
                              <div 
                                key={member.id} 
                                style={{ 
                                  marginLeft: idx === 0 ? 0 : -8, 
                                  border: '2px solid var(--color-surface)', 
                                  borderRadius: '50%',
                                  overflow: 'hidden',
                                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                                  zIndex: 10 - idx
                                }}
                                title={`${member.full_name || member.name} (${member.role || 'sales'})`}
                              >
                                <Avatar src={member.avatar_url || member.avatar} name={member.full_name || member.name} size={28} />
                              </div>
                            ))}
                            {projectRoster.length > 5 && (
                              <div 
                                style={{ 
                                  marginLeft: -8, 
                                  width: 28, 
                                  height: 28, 
                                  borderRadius: '50%', 
                                  background: 'var(--color-border-light)', 
                                  color: 'var(--color-text)', 
                                  fontSize: '0.7rem', 
                                  fontWeight: 800, 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center',
                                  border: '2px solid var(--color-surface)',
                                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                                  zIndex: 5
                                }}
                              >
                                +{projectRoster.length - 5}
                              </div>
                            )}
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', marginLeft: '8px' }}>
                            ({projectRoster.length} nhân sự)
                          </span>
                        </div>
                      )}
                    </div>
                    <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '0.75rem' }}>
                      <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '6px' }}>Tài liệu liên kết</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {parseIds(editingProject?.document_ids).length === 0 ? (
                          <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>Chưa liên kết tài liệu</span>
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
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: 'var(--color-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600 }}
                              >
                                <FileText size={14} style={{ flexShrink: 0 }} /> {formatFileName(fileObj.name, 75)}
                              </a>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Linked Tasks */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block' }}>
                    Nhiệm vụ & Công việc liên kết ({linkedTasks.length})
                  </span>
                  {loadingLinkedTasks ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
                      <RefreshCw className="spin" size={16} color="var(--color-text-muted)" />
                    </div>
                  ) : linkedTasks.length === 0 ? (
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '10px 14px', background: 'var(--color-bg-light)', border: '1px dashed var(--color-border)', borderRadius: '10px' }}>
                      Chưa có công việc nào liên kết với dự án này.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {linkedTasks.map(task => {
                        const statusColors: any = {
                          planned: { bg: 'rgba(245, 158, 11, 0.08)', text: 'var(--color-warning)' },
                          done: { bg: 'rgba(16, 185, 129, 0.08)', text: 'var(--color-success)' },
                          cancelled: { bg: 'rgba(239, 68, 68, 0.08)', text: 'var(--color-danger)' }
                        };
                        const sc = statusColors[task.status] || statusColors.planned;
                        const performer = users.find(u => Number(u.id) === Number(task.user_id));
                        return (
                          <div
                            key={task.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: 'var(--color-bg-light)',
                              border: '1px solid var(--color-border-light)',
                              padding: '10px 14px',
                              borderRadius: '10px',
                              fontSize: '0.85rem'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <CheckSquare size={16} color={task.status === 'done' ? 'var(--color-success)' : 'var(--color-text-muted)'} />
                              <div>
                                <span style={{ fontWeight: 600, color: 'var(--color-text)', display: 'block' }}>{task.subject}</span>
                                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                                  {performer?.full_name || 'Hệ thống'}
                                </span>
                              </div>
                            </div>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '100px', background: sc.bg, color: sc.text }}>
                              {task.status === 'done' ? 'Đã xong' : 'Chưa xong'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            </div>
          </>
        ) : (
          /* Changelog Tab View */
          <div style={{
            background: '#ffffff',
            border: '1px solid var(--color-border-light)',
            borderRadius: '16px',
            padding: '1.5rem',
            minHeight: '300px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '3px', height: '14px', background: 'var(--color-primary)', borderRadius: '1.5px', flexShrink: 0 }} />
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lịch sử hoạt động của Dự án</h4>
            </div>
            
            {statsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                <RefreshCw className="spin" size={24} color="var(--color-text-muted)" />
              </div>
            ) : !projectStats?.logs || projectStats.logs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)', fontSize: '0.875rem', fontStyle: 'italic' }}>
                Chưa có nhật ký hoạt động nào cho dự án này.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingLeft: '8px' }}>
                {projectStats.logs.map((log: any, idx: number) => (
                  <div key={log.id} style={{ display: 'flex', gap: '12px', position: 'relative' }}>
                    {idx !== projectStats.logs.length - 1 && (
                      <div style={{ position: 'absolute', top: '16px', left: '7px', bottom: '-24px', width: '2px', background: 'var(--color-border-light)' }} />
                    )}
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--color-primary)', border: '4px solid #ffffff', boxShadow: '0 0 0 1px var(--color-border-light)', flexShrink: 0, marginTop: '2px' }} />
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, color: 'var(--color-text)' }}>{log.user_name || 'Hệ thống'}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: 600 }}>
                          {new Date(log.created_at).toLocaleString('vi-VN')}
                        </span>
                      </div>
                      <p style={{ margin: 0, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                        {log.new_data || log.action}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderCampaignViewDrawer = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border-light)', gap: '1.5rem', marginBottom: '0.25rem' }}>
          <button
            onClick={() => setCampaignDrawerTab('details')}
            style={{
              padding: '8px 4px 12px',
              background: 'none',
              border: 'none',
              borderBottom: campaignDrawerTab === 'details' ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: campaignDrawerTab === 'details' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Thông tin & Chỉ số
          </button>
          <button
            onClick={() => setCampaignDrawerTab('changelog')}
            style={{
              padding: '8px 4px 12px',
              background: 'none',
              border: 'none',
              borderBottom: campaignDrawerTab === 'changelog' ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: campaignDrawerTab === 'changelog' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Lịch sử thay đổi
          </button>
        </div>

        {campaignDrawerTab === 'details' ? (
          <>
            {/* KPI Summary Cards */}
            {campaignStats && (
              <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', minHeight: '100px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tổng Số Leads</span>
                    <div className="stat-icon" style={{ color: 'var(--color-primary)', opacity: 0.8 }}><Layers size={18} /></div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div className="stat-value" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>
                      {campaignStats.total_leads}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 2, fontWeight: 500 }}>Nhận từ kênh Ads/Sheet</div>
                  </div>
                </div>

                <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', minHeight: '100px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Đã Chuyển Đổi</span>
                    <div className="stat-icon" style={{ color: '#6366f1', opacity: 0.8 }}><Users size={18} /></div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div className="stat-value" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>
                      {campaignStats.converted_leads}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 2, fontWeight: 500 }}>Tỷ lệ: {campaignStats.conversion_rate}%</div>
                  </div>
                </div>

                <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', minHeight: '100px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Giao Dịch Thành Công</span>
                    <div className="stat-icon" style={{ color: '#f59e0b', opacity: 0.8 }}><CheckSquare size={18} /></div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div className="stat-value" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>
                      {campaignStats.won_deals}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 2, fontWeight: 500 }}>Đã chốt (Đóng Deal)</div>
                  </div>
                </div>

                <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', minHeight: '100px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Doanh Thu Thực Thu</span>
                    <div className="stat-icon" style={{ color: '#10b981', opacity: 0.8 }}><Building2 size={18} /></div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div className="stat-value" style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={campaignStats.actual_revenue.toLocaleString('vi-VN') + ' VND'}>
                      {campaignStats.actual_revenue >= 1000000000 
                        ? `${(campaignStats.actual_revenue / 1000000000).toFixed(2)} tỷ` 
                        : `${(campaignStats.actual_revenue / 1000000).toFixed(0)} triệu`}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 2, fontWeight: 500 }}>Từ hóa đơn đã thu</div>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '1.5rem', alignItems: 'start' }}>
              {/* Left Column (3/5) */}
              <div style={{ flex: 3, width: isMobile ? '100%' : 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* Section 1: Thông tin cơ bản */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '3px', height: '14px', background: 'var(--color-primary)', borderRadius: '1.5px', flexShrink: 0 }} />
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Thông tin cơ bản</h4>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
                    <div>
                      <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Tên chiến dịch</span>
                      <span style={{ color: 'var(--color-text)', fontSize: '0.925rem', fontWeight: 700, display: 'block' }}>{editingCampaign?.name}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Trạng thái hoạt động</span>
                      <span 
                        className={`badge ${editingCampaign?.status === 'active' ? 'success' : 'secondary'}`}
                        style={{ fontSize: '0.75rem', padding: '5px 10px', borderRadius: '100px', fontWeight: 700, display: 'inline-block', marginTop: '2px' }}
                      >
                        {editingCampaign?.status === 'active' ? 'Hoạt động' : 'Tạm dừng'}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Ngày bắt đầu</span>
                      <span style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 600, display: 'block' }}>{editingCampaign?.start_date || 'Chưa thiết lập'}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Ngày kết thúc</span>
                      <span style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 600, display: 'block' }}>{editingCampaign?.end_date || 'Chưa thiết lập'}</span>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Đường dẫn Folder</span>
                      <div style={{ marginTop: '4px' }}>
                        {renderFolderPathLink(editingCampaign?.folder_path)}
                      </div>
                    </div>
                    {editingCampaign?.reference_url && (
                      <div style={{ gridColumn: 'span 2', marginTop: '4px', borderTop: '1px dotted var(--color-border-light)', paddingTop: '8px' }}>
                        <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Website / Link tham khảo</span>
                        <a
                          href={editingCampaign.reference_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: 'var(--color-primary)',
                            textDecoration: 'none',
                            fontWeight: 700,
                            fontSize: '0.875rem'
                          }}
                        >
                          {editingCampaign.reference_url.includes('docs.google.com/spreadsheets') || editingCampaign.reference_url.includes('google.com/sheets') ? (
                            <>
                              <FileSpreadsheet size={16} color="#10b981" />
                              <span style={{ color: '#10b981' }}>Bảng tính Google Sheets</span>
                            </>
                          ) : (
                            <>
                              <Link2 size={16} />
                              <span>Mở liên kết tham khảo</span>
                            </>
                          )}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Campaign Timeline Section */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '3px', height: '14px', background: 'var(--color-primary)', borderRadius: '1.5px', flexShrink: 0 }} />
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cột mốc & Tiến độ Chiến dịch</h4>
                  </div>
                  
                  {(() => {
                    const today = new Date();
                    const start = editingCampaign?.start_date ? new Date(editingCampaign.start_date) : null;
                    const end = editingCampaign?.end_date ? new Date(editingCampaign.end_date) : null;
                    
                    let phase = 1; // 1: Planning, 2: Active, 3: Completed
                    if (start && today >= start) {
                      phase = 2;
                    }
                    if (end && today > end) {
                      phase = 3;
                    }
                    
                    return (
                      <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', padding: '10px 0 20px' }}>
                        {/* Connecting Line */}
                        <div style={{ position: 'absolute', top: '25px', left: '10px', right: '10px', height: '2px', background: 'var(--color-border-light)', zIndex: 1 }} />
                        <div 
                          style={{ 
                            position: 'absolute', 
                            top: '25px', 
                            left: '10px', 
                            width: phase === 1 ? '0%' : (phase === 2 ? '50%' : '100%'), 
                            height: '2px', 
                            background: 'var(--color-primary)', 
                            zIndex: 2,
                            transition: 'width 0.3s ease'
                          }} 
                        />
                        
                        {[
                          { label: 'Lập kế hoạch', desc: 'Trước ngày bắt đầu' },
                          { label: 'Đang triển khai', desc: start ? `Từ ${new Date(start).toLocaleDateString('vi-VN')}` : 'Chạy Ads & Thu Lead' },
                          { label: 'Tổng kết', desc: end ? `Sau ${new Date(end).toLocaleDateString('vi-VN')}` : 'Đóng chiến dịch' }
                        ].map((item, idx) => {
                          const active = phase >= (idx + 1);
                          const current = phase === (idx + 1);
                          return (
                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 3, flex: 1, position: 'relative' }}>
                              <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: active ? 'var(--color-primary)' : '#ffffff',
                                border: active ? '2px solid var(--color-primary)' : '2px solid var(--color-border-light)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: active ? '#ffffff' : 'var(--color-text-muted)',
                                fontWeight: 800,
                                fontSize: '0.75rem',
                                boxShadow: current ? '0 0 0 4px rgba(189, 29, 45, 0.2)' : '0 2px 4px rgba(0,0,0,0.05)',
                                transition: 'all 0.2s ease',
                                transform: current ? 'scale(1.1)' : 'none'
                              }}>
                                {active ? <Check size={14} strokeWidth={3} /> : idx + 1}
                              </div>
                              <span style={{ fontSize: '0.72rem', fontWeight: active ? 750 : 600, color: active ? 'var(--color-text)' : 'var(--color-text-muted)', marginTop: '8px', textAlign: 'center' }}>
                                {item.label}
                              </span>
                              <span style={{ fontSize: '0.62rem', color: 'var(--color-text-light)', marginTop: '2px', textAlign: 'center' }}>
                                {item.desc}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* Section 3: Mô tả chiến dịch */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block' }}>Mô tả chiến dịch</span>
                  <p style={{ color: 'var(--color-text)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5, fontSize: '0.875rem' }}>
                    {editingCampaign?.description || 'Không có mô tả chi tiết'}
                  </p>
                </div>

                {/* Discussions/Comments */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>
                    Thảo luận & Trao đổi ({detailComments.length})
                  </span>
                  
                  <div style={{ background: 'var(--color-bg-light)', border: '1px solid var(--color-border-light)', padding: '12px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                    <MentionInput
                      users={users}
                      value={newCommentText}
                      onChange={e => setNewCommentText(e.target.value)}
                      placeholder="Viết bình luận... (Gõ @ để nhắc tên đồng nghiệp)"
                      style={{ minHeight: '55px', fontSize: '0.85rem' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--color-border-light)', paddingTop: '8px', marginTop: '2px' }}>
                      <button
                        onClick={() => handlePostDetailComment('campaign', editingCampaign!.id!)}
                        disabled={isSubmittingComment}
                        className="btn primary sm"
                        style={{ padding: '5px 16px', fontSize: '0.75rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <MessageSquare size={12} />
                        <span>Gửi bình luận</span>
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }} className="custom-scrollbar">
                    {loadingComments ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
                        <RefreshCw className="spin" size={16} color="var(--color-text-muted)" />
                      </div>
                    ) : detailComments.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.78rem', fontStyle: 'italic' }}>
                        Chưa có thảo luận nào.
                      </div>
                    ) : (
                      detailComments.map((comment: any) => (
                        <div key={comment.id} style={{ display: 'flex', gap: '8px', fontSize: '0.8125rem' }}>
                          <Avatar name={comment.user_name || 'User'} src={comment.avatar_url || undefined} size={24} />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', background: 'var(--color-bg-light)', border: '1px solid var(--color-border-light)', padding: '8px 12px', borderRadius: '12px', flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 800, color: 'var(--color-text)' }}>{comment.user_name || 'Thành viên'}</span>
                              <span style={{ fontSize: '0.65rem', color: 'var(--color-text-light)', fontWeight: 600 }}>
                                {new Date(comment.created_at).toLocaleString('vi-VN')}
                              </span>
                            </div>
                            <p style={{ margin: 0, color: 'var(--color-text)', lineHeight: 1.4 }}>{comment.body}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

              {/* Right Column (2/5) */}
              <div style={{ flex: 2, width: isMobile ? '100%' : 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* Section 2: Dự án & Nhân sự phụ trách */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '3px', height: '14px', background: 'var(--color-primary)', borderRadius: '1.5px', flexShrink: 0 }} />
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dự án &amp; Nhân sự phụ trách</h4>
                  </div>
                  
                  {(() => {
                    const associatedProjs = projects.filter(p => {
                      const campIds = p.campaign_ids ? p.campaign_ids.split(',').map((id: string) => id.trim()) : [];
                      return campIds.includes(editingCampaign?.name);
                    });

                    if (associatedProjs.length === 0) {
                      return (
                        <div style={{ padding: '1rem', background: 'var(--color-bg-light)', border: '1px dashed var(--color-border)', borderRadius: '12px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
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
                            <div key={proj.id} style={{ border: '1px solid var(--color-border-light)', borderRadius: '12px', padding: '1rem', background: 'var(--color-bg-light)' }}>
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

                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span>Thư mục:</span> {renderFolderPathLink(proj.folder_path, proj.id)}
                              </div>

                              <div style={{ marginBottom: '8px' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Tài liệu:</span>
                                {projDocs.length === 0 ? (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontStyle: 'italic' }}>Không có tài liệu</span>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {projDocs.map(doc => (
                                      <a
                                        key={doc.id}
                                        href={`${import.meta.env.VITE_API_URL ?? '/backend'}/${doc.file_path}`}
                                        download={doc.name}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ color: 'var(--color-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600 }}
                                      >
                                        <FileText size={12} style={{ flexShrink: 0 }} /> {doc.name}
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Nhân sự phụ trách:</span>
                                {campaignRostersLoading ? (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>Đang tải...</span>
                                ) : rosterList.length === 0 ? (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontStyle: 'italic' }}>Chưa phân công</span>
                                ) : (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {rosterList.map(member => (
                                      <span key={member.id} style={{ background: '#ffffff', border: '1px solid var(--color-border)', padding: '2px 8px', borderRadius: '100px', fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <Avatar src={member.avatar_url || member.avatar} name={member.full_name || member.name} size={16} />
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

                {/* Linked Tasks */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block' }}>
                    Nhiệm vụ & Công việc liên kết ({linkedTasks.length})
                  </span>
                  {loadingLinkedTasks ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
                      <RefreshCw className="spin" size={16} color="var(--color-text-muted)" />
                    </div>
                  ) : linkedTasks.length === 0 ? (
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '10px 14px', background: 'var(--color-bg-light)', border: '1px dashed var(--color-border)', borderRadius: '10px' }}>
                      Chưa có công việc nào liên kết với chiến dịch này.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {linkedTasks.map(task => {
                        const statusColors: any = {
                          planned: { bg: 'rgba(245, 158, 11, 0.08)', text: 'var(--color-warning)' },
                          done: { bg: 'rgba(16, 185, 129, 0.08)', text: 'var(--color-success)' },
                          cancelled: { bg: 'rgba(239, 68, 68, 0.08)', text: 'var(--color-danger)' }
                        };
                        const sc = statusColors[task.status] || statusColors.planned;
                        const performer = users.find(u => Number(u.id) === Number(task.user_id));
                        return (
                          <div
                            key={task.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: 'var(--color-bg-light)',
                              border: '1px solid var(--color-border-light)',
                              padding: '10px 14px',
                              borderRadius: '10px',
                              fontSize: '0.85rem'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <CheckSquare size={16} color={task.status === 'done' ? 'var(--color-success)' : 'var(--color-text-muted)'} />
                              <div>
                                <span style={{ fontWeight: 600, color: 'var(--color-text)', display: 'block' }}>{task.subject}</span>
                                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                                  {performer?.full_name || 'Hệ thống'}
                                </span>
                              </div>
                            </div>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '100px', background: sc.bg, color: sc.text }}>
                              {task.status === 'done' ? 'Đã xong' : 'Chưa xong'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            </div>
          </>
        ) : (
          /* Changelog Tab View */
          <div style={{
            background: '#ffffff',
            border: '1px solid var(--color-border-light)',
            borderRadius: '16px',
            padding: '1.5rem',
            minHeight: '300px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '3px', height: '14px', background: 'var(--color-primary)', borderRadius: '1.5px', flexShrink: 0 }} />
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lịch sử hoạt động của Chiến dịch</h4>
            </div>
            
            {statsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                <RefreshCw className="spin" size={24} color="var(--color-text-muted)" />
              </div>
            ) : !campaignStats?.logs || campaignStats.logs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)', fontSize: '0.875rem', fontStyle: 'italic' }}>
                Chưa có nhật ký hoạt động nào cho chiến dịch này.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingLeft: '8px' }}>
                {campaignStats.logs.map((log: any, idx: number) => (
                  <div key={log.id} style={{ display: 'flex', gap: '12px', position: 'relative' }}>
                    {idx !== campaignStats.logs.length - 1 && (
                      <div style={{ position: 'absolute', top: '16px', left: '7px', bottom: '-24px', width: '2px', background: 'var(--color-border-light)' }} />
                    )}
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--color-primary)', border: '4px solid #ffffff', boxShadow: '0 0 0 1px var(--color-border-light)', flexShrink: 0, marginTop: '2px' }} />
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, color: 'var(--color-text)' }}>{log.user_name || 'Hệ thống'}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: 600 }}>
                          {new Date(log.created_at).toLocaleString('vi-VN')}
                        </span>
                      </div>
                      <p style={{ margin: 0, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                        {log.new_data || log.action}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await fetchAPI(`projects?page=${projectPage}&limit=${projectPageSize}`);
      console.log('Projects API Response:', res);
      if (res.success) {
        if (res.data && typeof res.data === 'object' && 'data' in res.data) {
          const list = res.data.data || [];
          setProjects(list);
          const totalVal = Number(res.data.total);
          setTotalProjects(isNaN(totalVal) ? list.length : totalVal);
        } else {
          const arr = Array.isArray(res.data) ? res.data : [];
          setProjects(arr);
          setTotalProjects(arr.length);
        }
      } else {
        addToast(res.message || 'Lỗi tải danh sách dự án', 'error');
      }
    } catch (e: any) {
      console.error('loadProjects error:', e);
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

  const handleQuickUpload = async (e: React.ChangeEvent<HTMLInputElement>, projectId?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', file.name.split('.')[0]);
    fd.append('category', 'general');
    fd.append('visibility', 'shared');
    if (projectId) {
      fd.append('project_id', String(projectId));
    }
    try {
      const res = await fetchAPI('cloud-files', {
        method: 'POST',
        body: fd
      });
      if (res.success || res.id) {
        addToast('Đã tải tài liệu lên thành công!', 'success');
        loadAllFiles();
        const newFileId = String(res.data?.id || res.id);
        if (newFileId) {
          if (editingProject) {
            const currentIds = parseIds(editingProject.document_ids);
            if (!currentIds.includes(newFileId)) {
              const updatedIds = [...currentIds, newFileId].join(',');
              setEditingProject({ ...editingProject, document_ids: updatedIds });
            }
          } else if (editingCampaign) {
            const currentIds = parseIds(editingCampaign.document_ids);
            if (!currentIds.includes(newFileId)) {
              const updatedIds = [...currentIds, newFileId].join(',');
              setEditingCampaign({ ...editingCampaign, document_ids: updatedIds });
            }
          }
        }
      } else {
        addToast(res.message || 'Lỗi khi tải tài liệu lên', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Lỗi tải tệp tin', 'error');
    } finally {
      setUploadingDoc(false);
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
    if (isSaving) return;

    try {
      setIsSaving(true);
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
    } finally {
      setIsSaving(false);
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
    if (isSaving) return;

    try {
      setIsSaving(true);
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
    } finally {
      setIsSaving(false);
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
    setRosterSearch('');
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
        loadProjects();
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
        loadProjects();
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
            loadProjects();
          } else {
            addToast(res.message || 'Lỗi xóa tài liệu', 'error');
          }
        } catch (e: any) {
          addToast(e.message || 'Lỗi kết nối', 'error');
        }
      }
    });
  };

  const handleRenameDoc = (doc: any) => {
    setEditingDocKey(`${doc.isLinkedOnly ? 'link' : 'direct'}-${doc.id}`);
    setEditDocNameVal(doc.name);
  };

  const handleSaveRenameDoc = async (doc: any) => {
    if (!editDocNameVal || editDocNameVal.trim() === '' || editDocNameVal === doc.name) {
      setEditingDocKey(null);
      return;
    }

    try {
      let res;
      if (doc.isLinkedOnly) {
        res = await fetchAPI(`cloud-files/${doc.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name: editDocNameVal.trim() })
        });
      } else {
        res = await fetchAPI(`projects/${selectedProjectId}/documents/${doc.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name: editDocNameVal.trim() })
        });
      }

      if (res.success) {
        addToast('Đổi tên tài liệu thành công!', 'success');
        setEditingDocKey(null);
        if (selectedProjectId) {
          loadDocuments(selectedProjectId);
        }
        loadAllFiles();
        loadProjects();
      } else {
        addToast(res.message || 'Lỗi đổi tên tài liệu', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
    }
  };

  const handleDownloadDoc = (docId: number) => {
    if (!selectedProjectId) return;
    const token = localStorage.getItem('access_token') || localStorage.getItem('richland_token') || '';
    const url = `${import.meta.env.VITE_API_URL || '/backend'}/api.php?action=projects/${selectedProjectId}/documents/${docId}/download&token=${token}`;
    window.open(url, '_blank');
  };

  return (
    <div className="page-container anim-fade-up" style={{ color: 'var(--color-text)', height: 'auto', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {activeSubTab === 'campaigns' ? t('Quản Lý Chiến Dịch') : t('Quản Lý Dự Án')}
            <button
              onClick={() => setShowInfoModal(true)}
              style={{
                background: 'rgba(0, 0, 0, 0.02)',
                border: '1px solid var(--color-border)',
                padding: '3px 8px',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                transition: 'all 0.2s',
                height: '24px'
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
              title={t("Xem hướng dẫn thiết lập dự án, chiến dịch và roster")}
            >
              <Info size={12} style={{ marginTop: 1 }} />
              <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>{t("Giải thích cơ chế")}</span>
            </button>
          </h1>
          <p className="page-subtitle">{activeSubTab === 'campaigns' ? t('Cấu hình chiến dịch tiếp thị và quản lý roster nhận lead') : t('Đăng ký dự án, roster đội ngũ phân phối và quản lý tài liệu')}</p>
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

      {/* Tab Selector & Stats Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', width: '100%' }}>
        <div style={{
          display: 'flex',
          background: 'var(--color-border-light)',
          border: '1px solid var(--color-border)',
          padding: '2px',
          borderRadius: '8px',
          gap: '2px',
          width: 'fit-content',
          position: 'relative',
          maxWidth: '100%',
          overflowX: 'auto'
        }}>
          {/* Sliding Pill Background Indicator */}
          <div style={{
            position: 'absolute',
            top: '2px',
            bottom: '2px',
            width: '160px',
            borderRadius: '6px',
            background: 'var(--color-surface)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: `translateX(${activeSubTab === 'projects' ? '0px' : '162px'})`,
            zIndex: 1
          }} />

          {[
            { id: 'projects', label: 'Dự án', count: totalProjects, icon: <Building2 size={14} /> },
            { id: 'campaigns', label: 'Chiến dịch', count: totalCampaigns, icon: <Layers size={14} /> }
          ].map(tab => {
            const isSelected = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                style={{
                  width: '160px',
                  height: '32px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: 'transparent',
                  color: isSelected ? 'var(--color-text)' : 'var(--color-text-light)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  position: 'relative',
                  outline: 'none',
                  boxShadow: 'none',
                  zIndex: 2,
                  transition: 'color 0.2s ease'
                }}
                className=""
              >
                {tab.icon}
                <span>{tab.label}</span>
                <span style={{
                  fontSize: '0.72rem',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  background: isSelected ? 'var(--color-border-light)' : 'rgba(0, 0, 0, 0.04)',
                  color: isSelected ? 'var(--color-text)' : 'var(--color-text-muted)',
                  fontWeight: 800,
                  transition: 'background 0.2s ease, color 0.2s ease'
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ 
          fontSize: '0.825rem', 
          color: 'var(--color-text-muted)', 
          fontWeight: 650,
          background: 'var(--color-bg-light)',
          padding: '6px 12px',
          borderRadius: '20px',
          border: '1px solid var(--color-border-light)'
        }}>
          {activeSubTab === 'projects' 
            ? `Hiển thị ${projects.length} / ${totalProjects} dự án` 
            : `Hiển thị ${campaigns.length} / ${totalCampaigns} chiến dịch`
          }
        </div>
      </div>

      {/* Tab Panels with Enter Animation */}
      <div key={activeSubTab} className="subtab-enter-active" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* Projects List */}
      {activeSubTab === 'projects' && (
        loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth <= 768 ? 'repeat(auto-fill, minmax(280px, 1fr))' : 'repeat(3, 1fr)', gap: '1.5rem' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <ProjectCardSkeleton key={i} />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <EmptyCard 
            icon={<Building2 size={48} />}
            title="Chưa có dự án nào"
            description="Bắt đầu đăng ký các dự án bất động sản để phân phối và quản lý tài liệu."
            actionText={isAdmin ? "Thêm ngay" : undefined}
            onAction={isAdmin ? () => {
              setEditingProject({ status: 'active' });
              setAutoCode(true);
              setIsEditModalOpen(true);
            } : undefined}
          />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth <= 768 ? 'repeat(auto-fill, minmax(280px, 1fr))' : 'repeat(3, 1fr)', gap: '1.5rem' }}>
              {projects.map(proj => (
                <div
                  key={proj.id}
                  className="card flex flex-col justify-between hover:border-primary/50 transition-all duration-200"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setEditingProject(proj);
                    setProjectModalMode('view');
                    setIsEditModalOpen(true);
                  }}
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div 
                        className="project-card-header flex items-center gap-3"
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

                    {/* Construction Progress Bar */}
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.75rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>Tiến độ: {proj.construction_status || 'Chưa khởi công'}</span>
                        <span style={{ fontWeight: 800, color: (proj.progress_percent ?? 0) === 100 ? 'var(--color-success)' : 'var(--color-primary)' }}>{proj.progress_percent ?? 0}%</span>
                      </div>
                      <div style={{ width: '100%', height: '10px', background: 'var(--color-border-light)', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{ width: `${proj.progress_percent ?? 0}%`, height: '100%', background: (proj.progress_percent ?? 0) === 100 ? 'var(--color-success)' : 'linear-gradient(90deg, #BD1D2D, #F97316)', borderRadius: '99px', transition: 'width 0.4s var(--transition-fluid)' }}></div>
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
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenRoster(proj.id);
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--color-bg)', padding: '4px 8px', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-border-light)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--color-bg)'}
                      >
                        <Users size={12} /> {proj.roster_count || 0} nhân sự
                      </span>
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDocs(proj.id);
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--color-bg)', padding: '4px 8px', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-border-light)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--color-bg)'}
                      >
                        <FileText size={12} /> {(proj.doc_count || 0) + parseIds(proj.document_ids).length} tài liệu
                      </span>
                    </div>

                  </div>

                  <div className="flex gap-2 pt-4" style={{ borderTop: '1px solid var(--color-border)', marginTop: '1rem' }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDocs(proj.id);
                      }}
                      className="btn secondary sm flex-1 flex justify-center items-center gap-1.5"
                    >
                      <FileText size={14} />
                      Tài liệu
                    </button>
                    {isAdmin && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenRoster(proj.id);
                          }}
                          className="btn secondary sm"
                          title="Roster nhân viên"
                        >
                          <Users size={14} />
                        </button>
                        {canEditDeleteProject(proj) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
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
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProject(proj.id);
                            }}
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
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center', paddingBottom: '2.5rem' }}>
              <Pagination
                total={totalProjects}
                page={projectPage}
                pageSize={projectPageSize}
                onChange={setProjectPage}
                showSizeChanger={true}
                onPageSizeChange={setProjectPageSize}
              />
            </div>
          </>
        )
      )}

      {/* Campaigns List Tab */}
      {activeSubTab === 'campaigns' && (
        campaignsLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <CampaignCardSkeleton key={i} />
            ))}
          </div>
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
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center', paddingBottom: '2.5rem' }}>
              <Pagination
                total={totalCampaigns}
                page={campaignPage}
                pageSize={campaignPageSize}
                onChange={setCampaignPage}
                showSizeChanger={true}
                onPageSizeChange={setCampaignPageSize}
              />
            </div>
          </>
        )
      )}
      </div>

      {/* Edit Modal (converted to Drawer) */}
      {renderDrawer(
        isEditModalOpen,
        () => setIsEditModalOpen(false),
        projectModalMode === 'view' 
          ? `Chi tiết Dự án: ${editingProject?.name}` 
          : editingProject?.id ? 'Chỉnh sửa dự án' : 'Thêm dự án mới',
        <>
        {projectModalMode === 'view' ? (
          <>
            {renderProjectViewDrawer()}
            {isLegacyLayoutEnabled && (
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'start' }}>
            
            {/* Left Column (3/5) */}
            <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Section 1: Thông tin cơ bản */}
              <div style={{
                background: '#ffffff',
                border: '1px solid var(--color-border-light)',
                borderRadius: '16px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Thông tin cơ bản</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
                  <div>
                    <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Tên dự án</span>
                    <span style={{ color: 'var(--color-text)', fontSize: '0.925rem', fontWeight: 700, display: 'block' }}>{editingProject?.name}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Mã dự án</span>
                    <span style={{ color: 'var(--color-text)', fontSize: '0.925rem', fontWeight: 700, display: 'block', fontFamily: 'monospace' }}>{editingProject?.code}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Chủ đầu tư</span>
                    <span style={{ color: 'var(--color-text)', fontSize: '0.925rem', fontWeight: 700, display: 'block' }}>{editingProject?.developer || 'Chưa cập nhật'}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Trạng thái bán</span>
                    <span 
                      className={`badge ${editingProject?.status === 'active' ? 'success' : 'secondary'}`}
                      style={{ fontSize: '0.75rem', padding: '5px 10px', borderRadius: '100px', fontWeight: 700, display: 'inline-block', marginTop: '2px' }}
                    >
                      {editingProject?.status === 'active' ? 'Đang mở bán' : 'Tạm dừng bán'}
                    </span>
                  </div>
                  {editingProject?.reference_url && (
                    <div style={{ gridColumn: 'span 2', marginTop: '4px', borderTop: '1px dotted var(--color-border-light)', paddingTop: '8px' }}>
                      <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Website / Link tham khảo</span>
                      <a
                        href={editingProject.reference_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: 'var(--color-primary)',
                          textDecoration: 'none',
                          fontWeight: 700,
                          fontSize: '0.875rem'
                        }}
                      >
                        {editingProject.reference_url.includes('docs.google.com/spreadsheets') || editingProject.reference_url.includes('google.com/sheets') ? (
                          <>
                            <FileSpreadsheet size={16} color="#10b981" />
                            <span style={{ color: '#10b981' }}>Bảng tính Google Sheets</span>
                          </>
                        ) : (
                          <>
                            <Link2 size={16} />
                            <span>Mở liên kết tham khảo</span>
                          </>
                        )}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 2: Vị trí & Quy mô & Pháp lý */}
              <div style={{
                background: '#ffffff',
                border: '1px solid var(--color-border-light)',
                borderRadius: '16px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vị trí, Quy mô & Pháp lý</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
                  <div>
                    <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Vị trí / Địa chỉ</span>
                    <span style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 600, display: 'block' }}>{editingProject?.location || 'Chưa cập nhật'}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Trạng thái thi công &amp; Tiến độ</span>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 600 }}>
                        {editingProject?.construction_status || 'Chưa khởi công'}
                      </span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 800, color: (editingProject?.progress_percent ?? 0) === 100 ? 'var(--color-success)' : 'var(--color-primary)' }}>
                        {editingProject?.progress_percent ?? 0}%
                      </span>
                    </div>
                    {/* Beautiful progress bar */}
                    <div style={{ height: '10px', background: 'var(--color-border-light)', borderRadius: '99px', overflow: 'hidden', marginTop: '4px', width: '100%' }}>
                      <div 
                        style={{ 
                          height: '100%', 
                          width: `${editingProject?.progress_percent ?? 0}%`, 
                          background: (editingProject?.progress_percent ?? 0) === 100 ? 'var(--color-success)' : 'linear-gradient(90deg, #BD1D2D, #F97316)',
                          borderRadius: '99px',
                          transition: 'width 0.4s var(--transition-fluid)'
                        }} 
                      />
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Trạng thái pháp lý</span>
                    <span style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 600, display: 'block' }}>{editingProject?.legal_status || 'Đang hoàn thiện pháp lý'}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Năm bàn giao dự kiến</span>
                    <span style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 600, display: 'block' }}>{editingProject?.handover_year || 2026}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Quy mô Block &amp; Căn hộ</span>
                    <span style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 600, display: 'block' }}>
                      {editingProject?.scale_block_count || 1} Block, {editingProject?.scale_unit_count || 100} căn hộ
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Đường dẫn Folder</span>
                    <div style={{ marginTop: '4px' }}>
                      {renderFolderPathLink(editingProject?.folder_path, editingProject?.id)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 4: Mô tả chi tiết */}
              <div style={{
                background: '#ffffff',
                border: '1px solid var(--color-border-light)',
                borderRadius: '16px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block' }}>Mô tả chi tiết</span>
                <p style={{ color: 'var(--color-text)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5, fontSize: '0.875rem' }}>
                  {editingProject?.description || 'Không có mô tả chi tiết'}
                </p>
              </div>

              {/* Discussions/Comments */}
              <div style={{
                background: '#ffffff',
                border: '1px solid var(--color-border-light)',
                borderRadius: '16px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>
                  Thảo luận & Trao đổi ({detailComments.length})
                </span>
                
                <div style={{ background: 'var(--color-bg-light)', border: '1px solid var(--color-border-light)', padding: '12px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                  <MentionInput
                    users={users}
                    value={newCommentText}
                    onChange={e => setNewCommentText(e.target.value)}
                    placeholder="Viết bình luận... (Gõ @ để nhắc tên đồng nghiệp)"
                    style={{ minHeight: '55px', fontSize: '0.85rem' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--color-border-light)', paddingTop: '8px', marginTop: '2px' }}>
                    <button
                      onClick={() => handlePostDetailComment('project', editingProject!.id!)}
                      disabled={isSubmittingComment}
                      className="btn primary sm"
                      style={{ padding: '5px 16px', fontSize: '0.75rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <MessageSquare size={12} />
                      <span>Gửi bình luận</span>
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }} className="custom-scrollbar">
                  {loadingComments ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
                      <RefreshCw className="spin" size={16} color="var(--color-text-muted)" />
                    </div>
                  ) : detailComments.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.78rem', fontStyle: 'italic' }}>
                      Chưa có thảo luận nào.
                    </div>
                  ) : (
                    detailComments.map((comment: any) => (
                      <div key={comment.id} style={{ display: 'flex', gap: '8px', fontSize: '0.8125rem' }}>
                        <Avatar name={comment.user_name || 'User'} src={comment.avatar_url || undefined} size={24} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', background: 'var(--color-bg-light)', border: '1px solid var(--color-border-light)', padding: '8px 12px', borderRadius: '12px', flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 800, color: 'var(--color-text)' }}>{comment.user_name || 'Thành viên'}</span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--color-text-light)', fontWeight: 600 }}>
                              {new Date(comment.created_at).toLocaleString('vi-VN')}
                            </span>
                          </div>
                          <p style={{ margin: 0, color: 'var(--color-text)', lineHeight: 1.4 }}>{comment.body}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Right Column (2/5) */}
            <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Section 3: Nhân sự & Tài liệu */}
              <div style={{
                background: '#ffffff',
                border: '1px solid var(--color-border-light)',
                borderRadius: '16px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quản lý &amp; Tài liệu</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '6px' }}>Manager phụ trách chính</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {parseIds(editingProject?.manager_ids).length === 0 ? (
                        <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>Chưa phân công manager phụ trách</span>
                      ) : (
                        parseIds(editingProject?.manager_ids).map(id => {
                          const u = users.find(usr => String(usr.id) === String(id));
                          if (!u) return null;
                          return (
                            <span key={id} style={{ background: 'var(--color-bg-light)', border: '1px solid var(--color-border)', padding: '4px 10px', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <Avatar src={u.avatar_url || u.avatar} name={u.full_name || u.fullname || u.username} size={18} />
                              {u.full_name || u.fullname || u.username}
                            </span>
                          );
                        })
                      )}
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '0.75rem' }}>
                    <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '6px' }}>Đội ngũ nhân sự phụ trách</span>
                    {projectRosterLoading ? (
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Đang tải danh sách nhân sự...</span>
                    ) : projectRoster.length === 0 ? (
                      <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>Chưa phân công nhân sự</span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', padding: '2px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {projectRoster.slice(0, 5).map((member: any, idx: number) => (
                            <div 
                              key={member.id} 
                              style={{ 
                                marginLeft: idx === 0 ? 0 : -8, 
                                border: '2px solid var(--color-surface)', 
                                borderRadius: '50%',
                                overflow: 'hidden',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                                zIndex: 10 - idx
                              }}
                              title={`${member.full_name || member.name} (${member.role || 'sales'})`}
                            >
                              <Avatar src={member.avatar_url || member.avatar} name={member.full_name || member.name} size={28} />
                            </div>
                          ))}
                          {projectRoster.length > 5 && (
                            <div 
                              style={{ 
                                marginLeft: -8, 
                                width: 28, 
                                height: 28, 
                                borderRadius: '50%', 
                                background: 'var(--color-border-light)', 
                                color: 'var(--color-text)', 
                                fontSize: '0.7rem', 
                                fontWeight: 800, 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                border: '2px solid var(--color-surface)',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                                zIndex: 5
                              }}
                            >
                              +{projectRoster.length - 5}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', marginLeft: '8px' }}>
                          ({projectRoster.length} nhân sự)
                        </span>
                      </div>
                    )}
                  </div>
                  <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '0.75rem' }}>
                    <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '6px' }}>Tài liệu liên kết</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {parseIds(editingProject?.document_ids).length === 0 ? (
                        <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>Chưa liên kết tài liệu</span>
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
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: 'var(--color-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600 }}
                            >
                              <FileText size={14} style={{ flexShrink: 0 }} /> {formatFileName(fileObj.name, 75)}
                            </a>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Linked Tasks */}
              <div style={{
                background: '#ffffff',
                border: '1px solid var(--color-border-light)',
                borderRadius: '16px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block' }}>
                  Nhiệm vụ & Công việc liên kết ({linkedTasks.length})
                </span>
                {loadingLinkedTasks ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
                    <RefreshCw className="spin" size={16} color="var(--color-text-muted)" />
                  </div>
                ) : linkedTasks.length === 0 ? (
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '10px 14px', background: 'var(--color-bg-light)', border: '1px dashed var(--color-border)', borderRadius: '10px' }}>
                    Chưa có công việc nào liên kết với dự án này.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {linkedTasks.map(task => {
                      const statusColors: any = {
                        planned: { bg: 'rgba(245, 158, 11, 0.08)', text: 'var(--color-warning)' },
                        done: { bg: 'rgba(16, 185, 129, 0.08)', text: 'var(--color-success)' },
                        cancelled: { bg: 'rgba(239, 68, 68, 0.08)', text: 'var(--color-danger)' }
                      };
                      const sc = statusColors[task.status] || statusColors.planned;
                      const performer = users.find(u => Number(u.id) === Number(task.user_id));
                      return (
                        <div
                          key={task.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'var(--color-bg-light)',
                            border: '1px solid var(--color-border-light)',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            fontSize: '0.85rem'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CheckSquare size={16} color={task.status === 'done' ? 'var(--color-success)' : 'var(--color-text-muted)'} />
                            <div>
                              <span style={{ fontWeight: 600, color: 'var(--color-text)', display: 'block' }}>{task.subject}</span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                                {performer?.full_name || 'Hệ thống'}
                              </span>
                            </div>
                          </div>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '100px', background: sc.bg, color: sc.text }}>
                            {task.status === 'done' ? 'Đã xong' : 'Chưa xong'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>
          )}
          </>
        ) : (
          <form id="project-form" onSubmit={handleSaveProject} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '1.5rem', alignItems: 'start' }}>
            <input 
              type="file" 
              ref={quickUploadInputRef} 
              style={{ display: 'none' }} 
              onChange={e => handleQuickUpload(e, editingProject?.id)} 
            />
            {/* Left Column (3/5) */}
            <div style={{ flex: 3, width: isMobile ? '100%' : 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Card 1: Thông tin cơ bản */}
              <div style={{
                background: '#ffffff',
                border: '1px solid var(--color-border-light)',
                borderRadius: '16px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Thông tin cơ bản</h4>
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
                          Chưa có chủ đầu tư nào!
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditModalOpen(false);
                            navigate('/suppliers');
                          }}
                          className="btn primary sm"
                          style={{ width: '100%', height: '38px', fontSize: '0.75rem' }}
                        >
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

                  <div>
                    <label className="form-label" style={{ fontWeight: 600 }}>Trạng thái bán</label>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0.875rem', background: 'var(--color-bg-light)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-light)', height: '44px' }}>
                      <div>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>Cho phép mở bán</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: editingProject?.status === 'active' ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
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
                      placeholder="Nhấp để chọn tỉnh/thành phố, xã/phường..."
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Website hoặc Link tham khảo (GG Sheets, tài liệu...)</label>
                    <input
                      type="text"
                      value={editingProject?.reference_url || ''}
                      onChange={e => setEditingProject(prev => ({ ...prev, reference_url: e.target.value }))}
                      className="form-input"
                      placeholder="Dán đường dẫn link website hoặc Google Sheets tham khảo..."
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Vị trí & Tiến độ */}
              <div style={{
                background: '#ffffff',
                border: '1px solid var(--color-border-light)',
                borderRadius: '16px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tiến độ & Quy mô</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="form-label" style={{ marginBottom: 0 }}>Tiến độ thi công</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={editingProject?.progress_percent ?? 0}
                          onChange={e => {
                            let val = Number(e.target.value);
                            if (val < 0) val = 0;
                            if (val > 100) val = 100;
                            setEditingProject(prev => ({ ...prev, progress_percent: val }));
                          }}
                          style={{
                            width: '64px',
                            height: '28px',
                            textAlign: 'center',
                            fontSize: '0.85rem',
                            fontWeight: 800,
                            padding: '2px 4px',
                            border: '1px solid var(--color-border)',
                            borderRadius: '6px',
                            background: 'var(--color-surface)',
                            color: (editingProject?.progress_percent ?? 0) === 100 ? 'var(--color-success)' : 'var(--color-primary)'
                          }}
                        />
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text-muted)' }}>%</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={editingProject?.progress_percent ?? 0}
                      onChange={e => setEditingProject(prev => ({ ...prev, progress_percent: Number(e.target.value) }))}
                      className="progress-slider"
                      style={{
                        background: (editingProject?.progress_percent ?? 0) === 100
                          ? 'var(--color-success)'
                          : 'linear-gradient(to right, #BD1D2D 0%, #F97316 ' + (editingProject?.progress_percent ?? 0) + '%, var(--color-border-light) ' + (editingProject?.progress_percent ?? 0) + '%, var(--color-border-light) 100%)'
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                      <span>0%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Trạng thái thi công</label>
                    <CustomSelect
                      searchable={true}
                      options={[
                        { value: 'Chưa khởi công', label: 'Chưa khởi công' },
                        { value: 'Đang thi công', label: 'Đang thi công' },
                        { value: 'Đang thi công móng', label: 'Đang thi công móng' },
                        { value: 'Đang xây thân', label: 'Đang xây thân' },
                        { value: 'Đã cất nóc', label: 'Đã cất nóc' },
                        { value: 'Đang hoàn thiện', label: 'Đang hoàn thiện' },
                        { value: 'Đã bàn giao', label: 'Đã bàn giao' }
                      ]}
                      value={editingProject?.construction_status || 'Chưa khởi công'}
                      onChange={val => {
                        const status = String(val);
                        let progress = editingProject?.progress_percent ?? 0;
                        if (status === 'Chưa khởi công') progress = 0;
                        else if (status === 'Đang thi công móng') progress = 15;
                        else if (status === 'Đang thi công') progress = 30;
                        else if (status === 'Đang xây thân') progress = 50;
                        else if (status === 'Đã cất nóc') progress = 75;
                        else if (status === 'Đang hoàn thiện') progress = 90;
                        else if (status === 'Đã bàn giao') progress = 100;
                        setEditingProject(prev => ({
                          ...prev,
                          construction_status: status,
                          progress_percent: progress
                        }));
                      }}
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
                </div>
              </div>

              {/* Card 3: Mô tả */}
              <div style={{
                background: '#ffffff',
                border: '1px solid var(--color-border-light)',
                borderRadius: '16px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                boxShadow: 'var(--shadow-sm)'
              }}>
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

            {/* Right Column (2/5) */}
            <div style={{ flex: 2, width: isMobile ? '100%' : 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Card 1: Nhân sự quản lý */}
              <div style={{
                background: '#ffffff',
                border: '1px solid var(--color-border-light)',
                borderRadius: '16px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nhân sự quản lý</h4>
                <div>
                  <label className="form-label">Manager phụ trách chính</label>
                  <CustomSelect
                    multiple
                    searchable={true}
                    showAvatars={true}
                    options={users
                      .filter(u => ['manager', 'director', 'admin', 'superadmin', 'super_admin'].includes(u.role))
                      .map(u => ({ value: String(u.id), label: `${u.full_name || u.fullname || u.username} (${u.role})`, avatar: u.avatar_url || u.avatar }))
                    }
                    value={parseIds(editingProject?.manager_ids)}
                    onChange={val => setEditingProject(prev => ({ ...prev, manager_ids: Array.isArray(val) ? val.join(',') : String(val) }))}
                    placeholder="Chọn manager..."
                  />
                </div>
              </div>

              {/* Card 2: Tài liệu & Liên kết */}
              <div style={{
                background: '#ffffff',
                border: '1px solid var(--color-border-light)',
                borderRadius: '16px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Thư mục & Tài liệu</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label className="form-label">Đường dẫn Folder liên kết</label>
                    <div style={{ display: 'flex', background: 'var(--color-bg)', padding: '4px', borderRadius: '10px', marginBottom: '12px', border: '1px solid var(--color-border-light)' }}>
                      <button
                        type="button"
                        onClick={() => setFolderLinkType('link')}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: 'none',
                          background: folderLinkType === 'link' ? 'var(--color-primary)' : 'transparent',
                          color: folderLinkType === 'link' ? 'white' : 'var(--color-text-muted)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          boxShadow: folderLinkType === 'link' ? '0 2px 4px rgba(163, 20, 34, 0.2)' : 'none'
                        }}
                      >
                        Dán Link (Drive...)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFolderLinkType('select')}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: 'none',
                          background: folderLinkType === 'select' ? 'var(--color-primary)' : 'transparent',
                          color: folderLinkType === 'select' ? 'white' : 'var(--color-text-muted)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          boxShadow: folderLinkType === 'select' ? '0 2px 4px rgba(163, 20, 34, 0.2)' : 'none'
                        }}
                      >
                        Chọn thư mục có sẵn
                      </button>
                    </div>

                    {folderLinkType === 'link' ? (
                      <input
                        type="text"
                        value={editingProject?.folder_path || ''}
                        onChange={e => setEditingProject(prev => ({ ...prev, folder_path: e.target.value }))}
                        className="form-input"
                        placeholder="Dán link thư mục Google Drive..."
                      />
                    ) : (
                      <CustomSelect
                        options={fileCategories.map(cat => ({ value: cat.label, label: cat.label }))}
                        value={editingProject?.folder_path || ''}
                        onChange={val => setEditingProject(prev => ({ ...prev, folder_path: val as string }))}
                        placeholder="Chọn thư mục từ /files..."
                      />
                    )}
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label className="form-label" style={{ marginBottom: 0 }}>Tài liệu đính kèm</label>
                      <button
                        type="button"
                        onClick={() => quickUploadInputRef.current?.click()}
                        disabled={uploadingDoc}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-primary)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: 0
                        }}
                      >
                        {uploadingDoc ? (
                          <RefreshCw className="spin" size={12} />
                        ) : (
                          <Plus size={12} />
                        )}
                        <span>Tải tệp mới</span>
                      </button>
                    </div>
                    <CustomSelect
                      multiple
                      searchable={true}
                      options={allFiles.map(f => ({ value: String(f.id), label: f.name }))}
                      value={parseIds(editingProject?.document_ids)}
                      onChange={val => setEditingProject(prev => ({ ...prev, document_ids: Array.isArray(val) ? val.join(',') : String(val) }))}
                      placeholder="Chọn tài liệu..."
                    />
                  </div>

                  <div>
                    <label className="form-label">Chiến dịch liên kết</label>
                    <CustomSelect
                      multiple
                      searchable={true}
                      options={campaigns.map(c => ({ value: c.name, label: c.name }))}
                      value={parseIds(editingProject?.campaign_ids)}
                      onChange={val => setEditingProject(prev => ({ ...prev, campaign_ids: Array.isArray(val) ? val.join(',') : String(val) }))}
                      placeholder="Chọn chiến dịch..."
                    />
                  </div>
                </div>
              </div>

            </div>
          </form>
        )}
      </>,
      '960px',
      projectModalMode === 'view' ? undefined : (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="submit"
            form="project-form"
            className="btn primary sm"
            disabled={isSaving}
            style={{ borderRadius: '100px', fontWeight: 700, background: 'var(--color-primary)', border: 'none', opacity: isSaving ? 0.7 : 1, cursor: isSaving ? 'not-allowed' : 'pointer' }}
          >
            {isSaving ? 'Đang lưu...' : 'Lưu dự án'}
          </button>
        </div>
      )
    )}

      {/* Roster Drawer */}
      {renderDrawer(
        isRosterModalOpen,
        () => setIsRosterModalOpen(false),
        "Cấu hình Roster Nhân Sự Phân Phối",
        (() => {
          const filtered = rosterMembers.filter(m => 
            (m.full_name || '').toLowerCase().includes(rosterSearch.toLowerCase()) ||
            (m.email || '').toLowerCase().includes(rosterSearch.toLowerCase())
          );

          const sorted = [...filtered].sort((a, b) => {
            const aAssigned = a.is_assigned === 1 ? 1 : 0;
            const bAssigned = b.is_assigned === 1 ? 1 : 0;
            return bAssigned - aAssigned;
          });

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Roster Search Box */}
              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  type="text"
                  placeholder="Tìm kiếm nhân sự theo tên hoặc email..."
                  value={rosterSearch}
                  onChange={e => setRosterSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.625rem 1rem',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.875rem',
                    background: 'var(--color-surface)',
                    color: 'var(--color-text)',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', paddingRight: '4px' }}>
                {sorted.length === 0 ? (
                  <div style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '2rem 0', fontSize: '0.875rem' }}>
                    Không tìm thấy nhân sự phù hợp
                  </div>
                ) : (
                  sorted.map(member => {
                    return (
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
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <Avatar name={member.full_name} size={36} />
                          <div>
                            <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>{member.full_name}</h4>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{member.email}</p>
                          </div>
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
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          {member.is_assigned === 1 && <Check size={14} />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })(),
        '650px',
        (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button 
              type="button" 
              className="btn secondary sm" 
              style={{ borderRadius: '100px', fontWeight: 700 }} 
              onClick={() => setIsRosterModalOpen(false)}
            >
              Hủy
            </button>
            <button 
              type="button" 
              className="btn primary sm" 
              style={{ borderRadius: '100px', fontWeight: 700, background: 'var(--color-primary)', border: 'none' }} 
              onClick={handleSaveRoster}
            >
              Lưu thay đổi
            </button>
          </div>
        )
      )}

      {/* Project Docs Drawer */}
      {renderDrawer(
        isDocsModalOpen,
        () => setIsDocsModalOpen(false),
        "Kho Tài Liệu Dự Án",
        (() => {
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
              {/* Linked Folder Area */}
              {selectedProj?.folder_path && (
                <div style={{
                  padding: '1rem',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(16, 185, 129, 0.04)',
                  borderColor: 'rgba(16, 185, 129, 0.2)'
                }}>
                  <div style={{ flex: 1, minWidth: 0, marginRight: '1rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Folder size={16} color="#10b981" />
                      Thư mục liên kết
                    </h4>
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedProj.folder_path}
                    </p>
                  </div>
                  {selectedProj.folder_path.startsWith('http') ? (
                    <a
                      href={selectedProj.folder_path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn success sm"
                      style={{ borderRadius: '100px', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', textDecoration: 'none', background: '#10b981', color: '#fff', border: 'none' }}
                    >
                      <ExternalLink size={14} />
                      Mở Google Drive
                    </a>
                  ) : (
                    <a
                      href={`/files?project_id=${selectedProj.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn success sm"
                      style={{ borderRadius: '100px', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', textDecoration: 'none', background: 'var(--color-primary)', color: '#fff', border: 'none' }}
                    >
                      <Folder size={14} />
                      Kho tài liệu
                    </a>
                  )}
                </div>
              )}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', paddingRight: '4px' }}>
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
                        {editingDocKey === `${doc.isLinkedOnly ? 'link' : 'direct'}-${doc.id}` ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                            <input
                              type="text"
                              className="form-input"
                              value={editDocNameVal}
                              onChange={e => setEditDocNameVal(e.target.value)}
                              style={{
                                fontSize: '0.875rem',
                                padding: '4px 8px',
                                height: '32px',
                                borderRadius: '6px',
                                width: '100%',
                                maxWidth: '380px'
                              }}
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveRenameDoc(doc);
                                if (e.key === 'Escape') setEditingDocKey(null);
                              }}
                            />
                            <button
                              onClick={() => handleSaveRenameDoc(doc)}
                              className="btn success sm"
                              style={{ minWidth: 'auto', padding: '0 0.5rem', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px' }}
                              title="Lưu"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => setEditingDocKey(null)}
                              className="btn secondary sm"
                              style={{ minWidth: 'auto', padding: '0 0.5rem', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
                              title="Hủy"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={doc.name}>
                                {formatFileName(doc.name, 75)}
                              </h4>
                              {doc.isLinkedOnly ? (
                                <span style={{ fontSize: '0.625rem', padding: '2px 8px', borderRadius: '100px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                  Tệp liên kết
                                </span>
                              ) : (
                                <span style={{ fontSize: '0.625rem', padding: '2px 8px', borderRadius: '100px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                  Tệp tải lên
                                </span>
                              )}
                            </div>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                              {doc.uploaded_by_name} • {(doc.file_size / 1024 / 1024).toFixed(2)} MB • {new Date(doc.created_at).toLocaleDateString()}
                            </p>
                          </>
                        )}
                      </div>
                      {editingDocKey !== `${doc.isLinkedOnly ? 'link' : 'direct'}-${doc.id}` && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => handleRenameDoc(doc)}
                            className="btn secondary sm"
                            style={{ minWidth: 'auto', padding: '0 0.5rem' }}
                            title="Đổi tên"
                          >
                            <Edit size={14} />
                          </button>
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
                      )}
                    </div>
                  ))
                )}
              </div>
              <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="btn secondary sm" style={{ borderRadius: '100px' }} onClick={() => setIsDocsModalOpen(false)}>Đóng</button>
              </div>
            </div>
          );
        })(),
        '700px'
      )}

      {/* Campaign Create/Edit Modal (converted to Drawer) */}
      {renderDrawer(
        isCampaignModalOpen,
        () => setIsCampaignModalOpen(false),
        campaignModalMode === 'view' 
          ? `Chi tiết Chiến dịch: ${editingCampaign?.name}` 
          : editingCampaign?.id ? 'Chỉnh sửa Chiến dịch' : 'Thêm Chiến dịch mới',
        <>
        {campaignModalMode === 'view' ? (
          <>
            {renderCampaignViewDrawer()}
            {isLegacyLayoutEnabled && (
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'start' }}>
            
            {/* Left Column (3/5) */}
            <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Section 1: Thông tin cơ bản */}
              <div style={{
                background: '#ffffff',
                border: '1px solid var(--color-border-light)',
                borderRadius: '16px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Thông tin cơ bản</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
                  <div>
                    <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Tên chiến dịch</span>
                    <span style={{ color: 'var(--color-text)', fontSize: '0.925rem', fontWeight: 700, display: 'block' }}>{editingCampaign?.name}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Trạng thái hoạt động</span>
                    <span 
                      className={`badge ${editingCampaign?.status === 'active' ? 'success' : 'secondary'}`}
                      style={{ fontSize: '0.75rem', padding: '5px 10px', borderRadius: '100px', fontWeight: 700, display: 'inline-block', marginTop: '2px' }}
                    >
                      {editingCampaign?.status === 'active' ? 'Hoạt động' : 'Tạm dừng'}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Ngày bắt đầu</span>
                    <span style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 600, display: 'block' }}>{editingCampaign?.start_date || 'Chưa thiết lập'}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Ngày kết thúc</span>
                    <span style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 600, display: 'block' }}>{editingCampaign?.end_date || 'Chưa thiết lập'}</span>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Đường dẫn Folder</span>
                    <div style={{ marginTop: '4px' }}>
                      {renderFolderPathLink(editingCampaign?.folder_path)}
                    </div>
                  </div>
                  {editingCampaign?.reference_url && (
                    <div style={{ gridColumn: 'span 2', marginTop: '4px', borderTop: '1px dotted var(--color-border-light)', paddingTop: '8px' }}>
                      <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Website / Link tham khảo</span>
                      <a
                        href={editingCampaign.reference_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: 'var(--color-primary)',
                          textDecoration: 'none',
                          fontWeight: 700,
                          fontSize: '0.875rem'
                        }}
                      >
                        {editingCampaign.reference_url.includes('docs.google.com/spreadsheets') || editingCampaign.reference_url.includes('google.com/sheets') ? (
                          <>
                            <FileSpreadsheet size={16} color="#10b981" />
                            <span style={{ color: '#10b981' }}>Bảng tính Google Sheets</span>
                          </>
                        ) : (
                          <>
                            <Link2 size={16} />
                            <span>Mở liên kết tham khảo</span>
                          </>
                        )}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: Mô tả chiến dịch */}
              <div style={{
                background: '#ffffff',
                border: '1px solid var(--color-border-light)',
                borderRadius: '16px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block' }}>Mô tả chiến dịch</span>
                <p style={{ color: 'var(--color-text)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5, fontSize: '0.875rem' }}>
                  {editingCampaign?.description || 'Không có mô tả chi tiết'}
                </p>
              </div>

              {/* Thảo luận & Trao đổi */}
              <div style={{
                background: '#ffffff',
                border: '1px solid var(--color-border-light)',
                borderRadius: '16px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>
                  Thảo luận & Trao đổi ({detailComments.length})
                </span>
                
                <div style={{ background: 'var(--color-bg-light)', border: '1px solid var(--color-border-light)', padding: '12px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                  <MentionInput
                    users={users}
                    value={newCommentText}
                    onChange={e => setNewCommentText(e.target.value)}
                    placeholder="Viết bình luận... (Gõ @ để nhắc tên đồng nghiệp)"
                    style={{ minHeight: '55px', fontSize: '0.85rem' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--color-border-light)', paddingTop: '8px', marginTop: '2px' }}>
                    <button
                      onClick={() => handlePostDetailComment('campaign', editingCampaign!.id!)}
                      disabled={isSubmittingComment}
                      className="btn primary sm"
                      style={{ padding: '5px 16px', fontSize: '0.75rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <MessageSquare size={12} />
                      <span>Gửi bình luận</span>
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }} className="custom-scrollbar">
                  {loadingComments ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
                      <RefreshCw className="spin" size={16} color="var(--color-text-muted)" />
                    </div>
                  ) : detailComments.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.78rem', fontStyle: 'italic' }}>
                      Chưa có thảo luận nào.
                    </div>
                  ) : (
                    detailComments.map((comment: any) => (
                      <div key={comment.id} style={{ display: 'flex', gap: '8px', fontSize: '0.8125rem' }}>
                        <Avatar name={comment.user_name || 'User'} src={comment.avatar_url || undefined} size={24} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', background: 'var(--color-bg-light)', border: '1px solid var(--color-border-light)', padding: '8px 12px', borderRadius: '12px', flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 800, color: 'var(--color-text)' }}>{comment.user_name || 'Thành viên'}</span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--color-text-light)', fontWeight: 600 }}>
                              {new Date(comment.created_at).toLocaleString('vi-VN')}
                            </span>
                          </div>
                          <p style={{ margin: 0, color: 'var(--color-text)', lineHeight: 1.4 }}>{comment.body}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Right Column (2/5) */}
            <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Section 2: Dự án liên kết & Nhân sự */}
              <div style={{
                background: '#ffffff',
                border: '1px solid var(--color-border-light)',
                borderRadius: '16px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dự án &amp; Nhân sự phụ trách</h4>
                
                {(() => {
                  const associatedProjs = projects.filter(p => {
                    const campIds = p.campaign_ids ? p.campaign_ids.split(',').map((id: string) => id.trim()) : [];
                    return campIds.includes(editingCampaign?.name);
                  });

                  if (associatedProjs.length === 0) {
                    return (
                      <div style={{ padding: '1rem', background: 'var(--color-bg-light)', border: '1px dashed var(--color-border)', borderRadius: '12px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
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
                          <div key={proj.id} style={{ border: '1px solid var(--color-border-light)', borderRadius: '12px', padding: '1rem', background: 'var(--color-bg-light)' }}>
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

                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span>Thư mục:</span> {renderFolderPathLink(proj.folder_path, proj.id)}
                            </div>

                            <div style={{ marginBottom: '8px' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Tài liệu:</span>
                              {projDocs.length === 0 ? (
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontStyle: 'italic' }}>Không có tài liệu</span>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {projDocs.map(doc => (
                                    <a
                                      key={doc.id}
                                      href={`${import.meta.env.VITE_API_URL ?? '/backend'}/${doc.file_path}`}
                                      download={doc.name}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{ color: 'var(--color-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600 }}
                                    >
                                      <FileText size={12} style={{ flexShrink: 0 }} /> {doc.name}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Nhân sự phụ trách:</span>
                              {campaignRostersLoading ? (
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>Đang tải...</span>
                              ) : rosterList.length === 0 ? (
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontStyle: 'italic' }}>Chưa phân công</span>
                              ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                  {rosterList.map(member => (
                                    <span key={member.id} style={{ background: '#ffffff', border: '1px solid var(--color-border)', padding: '2px 8px', borderRadius: '100px', fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                      <Avatar src={member.avatar_url || member.avatar} name={member.full_name || member.name} size={16} />
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

              {/* Linked Tasks */}
              <div style={{
                background: '#ffffff',
                border: '1px solid var(--color-border-light)',
                borderRadius: '16px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block' }}>
                  Nhiệm vụ & Công việc liên kết ({linkedTasks.length})
                </span>
                {loadingLinkedTasks ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
                    <RefreshCw className="spin" size={16} color="var(--color-text-muted)" />
                  </div>
                ) : linkedTasks.length === 0 ? (
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '10px 14px', background: 'var(--color-bg-light)', border: '1px dashed var(--color-border)', borderRadius: '10px' }}>
                    Chưa có công việc nào liên kết với chiến dịch này.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {linkedTasks.map(task => {
                      const statusColors: any = {
                        planned: { bg: 'rgba(245, 158, 11, 0.08)', text: 'var(--color-warning)' },
                        done: { bg: 'rgba(16, 185, 129, 0.08)', text: 'var(--color-success)' },
                        cancelled: { bg: 'rgba(239, 68, 68, 0.08)', text: 'var(--color-danger)' }
                      };
                      const sc = statusColors[task.status] || statusColors.planned;
                      const performer = users.find(u => Number(u.id) === Number(task.user_id));
                      return (
                        <div
                          key={task.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'var(--color-bg-light)',
                            border: '1px solid var(--color-border-light)',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            fontSize: '0.85rem'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CheckSquare size={16} color={task.status === 'done' ? 'var(--color-success)' : 'var(--color-text-muted)'} />
                            <div>
                              <span style={{ fontWeight: 600, color: 'var(--color-text)', display: 'block' }}>{task.subject}</span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                                {performer?.full_name || 'Hệ thống'}
                              </span>
                            </div>
                          </div>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '100px', background: sc.bg, color: sc.text }}>
                            {task.status === 'done' ? 'Đã xong' : 'Chưa xong'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>
          )}
          </>
        ) : (
          <form id="campaign-form" onSubmit={handleSaveCampaign} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '1.5rem', alignItems: 'start' }}>
            <input 
              type="file" 
              ref={quickUploadInputRef} 
              style={{ display: 'none' }} 
              onChange={e => handleQuickUpload(e)} 
            />
            {/* Left Column (3/5) */}
            <div style={{ flex: 3, width: isMobile ? '100%' : 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Card 1: Thông tin cơ bản */}
              <div style={{
                background: '#ffffff',
                border: '1px solid var(--color-border-light)',
                borderRadius: '16px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Thông tin cơ bản</h4>
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
                    <label className="form-label" style={{ fontWeight: 600 }}>Website hoặc Link tham khảo (GG Sheets, tài liệu...)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Dán đường dẫn link website hoặc Google Sheets tham khảo..."
                      value={editingCampaign?.reference_url || ''}
                      onChange={e => setEditingCampaign({ ...editingCampaign, reference_url: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 600 }}>Trạng thái chiến dịch</label>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0.875rem', background: 'var(--color-bg-light)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-light)', height: '44px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: editingCampaign?.status === 'active' ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                        {editingCampaign?.status === 'active' ? 'Hoạt động' : 'Tạm dừng'}
                      </span>
                      <ToggleSwitch
                        checked={editingCampaign?.status === 'active'}
                        onChange={checked => setEditingCampaign({ ...editingCampaign, status: checked ? 'active' : 'inactive' })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Mô tả */}
              <div style={{
                background: '#ffffff',
                border: '1px solid var(--color-border-light)',
                borderRadius: '16px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Mô tả chiến dịch</label>
                <textarea
                  className="form-input"
                  placeholder="Mô tả mục tiêu, nguồn lead, ngân sách..."
                  rows={3}
                  value={editingCampaign?.description || ''}
                  onChange={e => setEditingCampaign({ ...editingCampaign, description: e.target.value })}
                  style={{ minHeight: '80px', padding: '10px 14px' }}
                />
              </div>

            </div>

            {/* Right Column (2/5) */}
            <div style={{ flex: 2, width: isMobile ? '100%' : 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Card 1: Nhân sự & Dự án liên kết */}
              <div style={{
                background: '#ffffff',
                border: '1px solid var(--color-border-light)',
                borderRadius: '16px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nhân sự &amp; Dự án</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Dự án liên kết (Chọn nhiều)</label>
                    <CustomSelect
                      multiple
                      searchable={true}
                      options={projects.map(p => ({ value: p.name, label: `${p.name} (${p.code})` }))}
                      value={parseIds(editingCampaign?.project_ids)}
                      onChange={val => setEditingCampaign({ ...editingCampaign, project_ids: Array.isArray(val) ? val.join(',') : String(val) })}
                      placeholder="Chọn các dự án..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Manager phụ trách chính</label>
                    <CustomSelect
                      multiple
                      searchable={true}
                      showAvatars={true}
                      options={users
                        .filter(u => ['manager', 'director', 'admin', 'superadmin', 'super_admin'].includes(u.role))
                        .map(u => ({ value: String(u.id), label: `${u.full_name || u.fullname || u.username} (${u.role})`, avatar: u.avatar_url || u.avatar }))
                      }
                      value={parseIds(editingCampaign?.manager_ids)}
                      onChange={val => setEditingCampaign({ ...editingCampaign, manager_ids: Array.isArray(val) ? val.join(',') : String(val) })}
                      placeholder="Chọn manager..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Nhân sự liên kết</label>
                    <CustomSelect
                      multiple
                      searchable={true}
                      showAvatars={true}
                      options={users.map(u => ({ value: String(u.id), label: `${u.full_name || u.fullname || u.username} (${u.role})`, avatar: u.avatar_url || u.avatar }))}
                      value={parseIds(editingCampaign?.user_ids)}
                      onChange={val => setEditingCampaign({ ...editingCampaign, user_ids: Array.isArray(val) ? val.join(',') : String(val) })}
                      placeholder="Chọn nhân sự..."
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Tài liệu & Thư mục */}
              <div style={{
                background: '#ffffff',
                border: '1px solid var(--color-border-light)',
                borderRadius: '16px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Thư mục & Tài liệu</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Đường dẫn Folder liên kết</label>
                    <div style={{ display: 'flex', background: 'var(--color-bg)', padding: '4px', borderRadius: '10px', marginBottom: '12px', border: '1px solid var(--color-border-light)' }}>
                      <button
                        type="button"
                        onClick={() => setCampaignFolderLinkType('link')}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: 'none',
                          background: campaignFolderLinkType === 'link' ? 'var(--color-primary)' : 'transparent',
                          color: campaignFolderLinkType === 'link' ? 'white' : 'var(--color-text-muted)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          boxShadow: campaignFolderLinkType === 'link' ? '0 2px 4px rgba(163, 20, 34, 0.2)' : 'none'
                        }}
                      >
                        Dán Link (Drive...)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCampaignFolderLinkType('select')}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: 'none',
                          background: campaignFolderLinkType === 'select' ? 'var(--color-primary)' : 'transparent',
                          color: campaignFolderLinkType === 'select' ? 'white' : 'var(--color-text-muted)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          boxShadow: campaignFolderLinkType === 'select' ? '0 2px 4px rgba(163, 20, 34, 0.2)' : 'none'
                        }}
                      >
                        Chọn thư mục có sẵn
                      </button>
                    </div>

                    {campaignFolderLinkType === 'link' ? (
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Dán link thư mục Google Drive..."
                        value={editingCampaign?.folder_path || ''}
                        onChange={e => setEditingCampaign({ ...editingCampaign, folder_path: e.target.value })}
                      />
                    ) : (
                      <CustomSelect
                        options={fileCategories.map(cat => ({ value: cat.label, label: cat.label }))}
                        value={editingCampaign?.folder_path || ''}
                        onChange={val => setEditingCampaign({ ...editingCampaign, folder_path: val as string })}
                        placeholder="Chọn thư mục từ /files..."
                      />
                    )}
                  </div>

                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label className="form-label" style={{ fontWeight: 600, marginBottom: 0 }}>Tài liệu đính kèm</label>
                      <button
                        type="button"
                        onClick={() => quickUploadInputRef.current?.click()}
                        disabled={uploadingDoc}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-primary)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: 0
                        }}
                      >
                        {uploadingDoc ? (
                          <RefreshCw className="spin" size={12} />
                        ) : (
                          <Plus size={12} />
                        )}
                        <span>Tải tệp mới</span>
                      </button>
                    </div>
                    <CustomSelect
                      multiple
                      searchable={true}
                      options={allFiles.map(f => ({ value: String(f.id), label: f.name }))}
                      value={parseIds(editingCampaign?.document_ids)}
                      onChange={val => setEditingCampaign({ ...editingCampaign, document_ids: Array.isArray(val) ? val.join(',') : String(val) })}
                      placeholder="Chọn tài liệu..."
                    />
                  </div>
                </div>
              </div>

            </div>
          </form>
        )}
      </>,
      '850px',
      campaignModalMode === 'view' ? undefined : (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="submit"
            form="campaign-form"
            className="btn primary sm"
            disabled={isSaving}
            style={{ borderRadius: '100px', fontWeight: 700, background: 'var(--color-primary)', border: 'none', opacity: isSaving ? 0.7 : 1, cursor: isSaving ? 'not-allowed' : 'pointer' }}
          >
            {isSaving ? 'Đang lưu...' : 'Lưu chiến dịch'}
          </button>
        </div>
      )
    )}
      {/* Explanation of Projects & Campaigns Modal */}
      <CustomModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title={t("Hướng dẫn Thiết lập Dự án & Chiến dịch & Roster")}
        width="760px"
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
              {t("Dự án và Chiến dịch marketing là nguồn phát sinh dữ liệu khách hàng (lead). Việc cấu hình đúng đắn quyết định đường đi của lead và đội ngũ tiếp nhận chăm sóc:")}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Dự án */}
            <div style={{ 
              display: 'flex', 
              gap: 12, 
              padding: '1rem', 
              background: theme === 'dark' ? 'rgba(59, 130, 246, 0.04)' : 'rgba(59, 130, 246, 0.02)', 
              borderLeft: '4px solid #3b82f6', 
              borderTop: '1px solid var(--color-border-light)',
              borderRight: '1px solid var(--color-border-light)',
              borderBottom: '1px solid var(--color-border-light)',
              borderRadius: '0 8px 8px 0'
            }}>
              <Building2 size={20} color="#3b82f6" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  {t("1. Quản lý Dự án & Tài liệu (Projects & Drive)")}
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  • <strong>Dự án (Project)</strong>: Sản phẩm căn hộ, đất nền hoặc dự án phân phối. Mã dự án (Code) là duy nhất dùng để so khớp UTM parameter khi lead đổ về.<br />
                  • <strong>Tài liệu dự án</strong>: Lưu trữ tài liệu (Flyer, bảng giá, pháp lý) để TVV truy cập nhanh từ Workspace.
                </p>
              </div>
            </div>

            {/* Chiến dịch */}
            <div style={{ 
              display: 'flex', 
              gap: 12, 
              padding: '1rem', 
              background: theme === 'dark' ? 'rgba(16, 185, 129, 0.04)' : 'rgba(16, 185, 129, 0.02)', 
              borderLeft: '4px solid #10b981', 
              borderTop: '1px solid var(--color-border-light)',
              borderRight: '1px solid var(--color-border-light)',
              borderBottom: '1px solid var(--color-border-light)',
              borderRadius: '0 8px 8px 0'
            }}>
              <Layers size={20} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  {t("2. Chiến dịch tiếp thị (Marketing Campaigns)")}
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  • <strong>Chiến dịch (Campaign)</strong>: Đại diện cho các chiến dịch quảng cáo chạy cho dự án (vd: FB Ads, Google Search). Mỗi chiến dịch kết nối với các thẻ UTM tương ứng để phân loại nguồn gốc khách hàng và tính toán chi phí vận hành (CPL/CPA).
                </p>
              </div>
            </div>

            {/* Roster */}
            <div style={{ 
              display: 'flex', 
              gap: 12, 
              padding: '1rem', 
              background: theme === 'dark' ? 'rgba(245, 158, 11, 0.04)' : 'rgba(245, 158, 11, 0.02)', 
              borderLeft: '4px solid #f59e0b', 
              borderTop: '1px solid var(--color-border-light)',
              borderRight: '1px solid var(--color-border-light)',
              borderBottom: '1px solid var(--color-border-light)',
              borderRadius: '0 8px 8px 0'
            }}>
              <Users size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  {t("3. Đội ngũ tiếp nhận & Roster (Project/Campaign Roster)")}
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  • <strong>Roster</strong>: Danh sách nhân viên kinh doanh được kích hoạt tham gia bán dự án/chiến dịch này. <strong>Hệ thống chỉ chia lead cho TVV có tên trong Roster của Dự án/Chiến dịch đó</strong>. Điều này giúp đảm bảo lead được giao đúng người có chuyên môn và chứng chỉ phù hợp.
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
}
