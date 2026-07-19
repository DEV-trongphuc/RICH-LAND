import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { fetchAPI } from '../utils/api';
import api from '../api/axios';
import { useAuth } from '../contexts/AuthContext';
import { useUIStore } from '../store/uiStore';
import { Building2, Users, FileText, Plus, Trash2, Edit, X, Upload, Download, Check, AlertCircle, Layers, FileSpreadsheet, Link2, Globe, Search, Folder, ExternalLink, MessageSquare, Paperclip, RefreshCw, Calendar, CheckSquare, HardDrive, Info, MapPin, Briefcase, AlignLeft, Filter, History, Megaphone } from 'lucide-react';
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
import { WorkspaceTaskDrawer } from './WorkspaceTaskDrawer';
import { FilesPage } from './FilesPage';



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
  campaign_ids_array?: number[];
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
  campaign_sharing_mode?: string;
}

interface RosterMember {
  id: number;
  full_name: string;
  email: string;
  role: string;
  is_assigned: number;
  avatar_url?: string;
  team_id?: number;
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

interface ReferenceLink {
  title: string;
  url: string;
}

interface FolderPathObj {
  type: 'link' | 'select';
  path: string;
}

const parseReferenceLinks = (urlStr: string | undefined): ReferenceLink[] => {
  if (!urlStr) return [];
  try {
    const parsed = JSON.parse(urlStr);
    if (Array.isArray(parsed)) {
      return parsed.map((item: any) => ({
        title: String(item.title || 'Website / Link tham khảo'),
        url: String(item.url || '')
      }));
    }
  } catch (e) {
    // Legacy single URL string
  }
  return [{ title: 'Website / Link tham khảo', url: urlStr }];
};

const parseFolderPaths = (pathStr: string | undefined): FolderPathObj[] => {
  if (!pathStr) return [];
  try {
    const parsed = JSON.parse(pathStr);
    if (Array.isArray(parsed)) {
      return parsed.map((item: any) => ({
        type: item.type === 'link' || item.type === 'select' ? item.type : 'link',
        path: String(item.path || '')
      }));
    }
  } catch (e) {
    // Legacy single path
  }
  const isUrl = pathStr.startsWith('http://') || pathStr.startsWith('https://');
  return [{ type: isUrl ? 'link' : 'select', path: pathStr }];
};

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
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderModalPath, setFolderModalPath] = useState('');
  const [folderModalProjectId, setFolderModalProjectId] = useState<number | null>(null);
  const [folderFiles, setFolderFiles] = useState<any[]>([]);
  const [folderFilesLoading, setFolderFilesLoading] = useState(false);

  const loadFolderFiles = async (projectId: number) => {
    setFolderFilesLoading(true);
    try {
      const res = await fetchAPI(`cloud-files?project_id=${projectId}&limit=100`);
      if (res.success) {
        const data = res.data?.items || res.data || [];
        setFolderFiles(data);
      }
    } catch (e) {
      console.error('Failed to load folder files', e);
    } finally {
      setFolderFilesLoading(false);
    }
  };

  const handleOpenFolderModal = (path: string, projectId: number) => {
    console.log('handleOpenFolderModal called: path=', path, 'projectId:', projectId);
    setFolderModalPath(path);
    setFolderModalProjectId(projectId);
    setFolderFiles([]);
    setShowFolderModal(true);
    loadFolderFiles(projectId);
  };
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
  const [projectTasksPage, setProjectTasksPage] = useState(1);
  const [campaignTasksPage, setCampaignTasksPage] = useState(1);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignProjectFilter, setCampaignProjectFilter] = useState<string>('');
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
  const [selectedTaskForDrawer, setSelectedTaskForDrawer] = useState<any>(null);

  // Quick campaigns modal state
  const [quickCampaignsModalOpen, setQuickCampaignsModalOpen] = useState(false);
  const [quickCampaignsProject, setQuickCampaignsProject] = useState<any | null>(null);
  const [quickCampaignsList, setQuickCampaignsList] = useState<any[]>([]);

  const handleOpenQuickCampaigns = (proj: any, linkedCamps: any[]) => {
    setQuickCampaignsProject(proj);
    setQuickCampaignsList(linkedCamps);
    setQuickCampaignsModalOpen(true);
  };

  const renderQuickCampaignsDrawer = () => {
    return renderDrawer(
      quickCampaignsModalOpen,
      () => setQuickCampaignsModalOpen(false),
      `Chiến dịch liên kết - ${quickCampaignsProject?.name || ''}`,
      (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem' }}>
          {quickCampaignsList.length === 0 ? (
            <EmptyCard
              icon={<Layers size={48} />}
              title="Chưa có chiến dịch liên kết"
              description="Không tìm thấy chiến dịch nào liên kết với dự án này."
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {quickCampaignsList.map(camp => {
                const docCount = parseIds(camp.document_ids).length;
                const staffCount = parseIds(camp.user_ids).length;
                return (
                  <div
                    key={camp.id}
                    style={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem', gap: '8px' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }} className="line-clamp-1">
                          {camp.name}
                        </h4>
                        <span className={`badge ${camp.status === 'active' ? 'success' : 'secondary'}`} style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '100px', fontWeight: 700 }}>
                          {camp.status === 'active' ? 'Hoạt động' : 'Tạm dừng'}
                        </span>
                      </div>
                      {camp.description ? (
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '1rem', lineHeight: 1.4 }} className="line-clamp-2">
                          {camp.description}
                        </p>
                      ) : (
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontStyle: 'italic', marginBottom: '1rem' }}>
                          Không có mô tả chi tiết
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dotted var(--color-border-light)', paddingTop: '0.75rem', marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <span><strong>{docCount}</strong> Tài liệu</span>
                        <span>•</span>
                        <span><strong>{staffCount}</strong> Nhân sự</span>
                      </div>
                      <button
                        onClick={() => {
                          setQuickCampaignsModalOpen(false);
                          handleOpenCampaignView(camp);
                        }}
                        className="btn outline sm"
                        style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '4px' }}
                      >
                        Chi tiết
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ),
      '650px'
    );
  };

  const handleOpenTask = (taskId: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set('task_id', String(taskId));
    navigate(`${window.location.pathname}?${params.toString()}`);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const taskId = params.get('task_id');
    if (taskId) {
      const tid = Number(taskId);
      if (tid) {
        api.get(`/activities/${tid}`).then(res => {
          if (res.data && res.data.success && res.data.data) {
            setSelectedTaskForDrawer(res.data.data);
          }
        }).catch(err => {
          console.error("Error loading task from URL:", err);
        });
      }
    }
  }, [window.location.search]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isCampaigns = params.get('tab') === 'campaigns' || params.get('sub') === 'campaigns';
    if (isCampaigns) {
      setActiveSubTab('campaigns');
    } else {
      setActiveSubTab('projects');
    }

    const targetId = params.get('id') || params.get('project_id');
    if (targetId) {
      if (isCampaigns) {
        if (campaigns.length > 0) {
          const matched = campaigns.find(c => String(c.id) === targetId);
          if (matched) {
            setEditingCampaign(matched);
            setCampaignModalMode('view');
            setIsCampaignModalOpen(true);

            // clean url parameters
            const newParams = new URLSearchParams(window.location.search);
            newParams.delete('id');
            newParams.delete('project_id');
            const cleanUrl = window.location.pathname + (newParams.toString() ? '?' + newParams.toString() : '');
            window.history.replaceState({}, '', cleanUrl);
          }
        }
      } else {
        if (projects.length > 0) {
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
      }
    }
  }, [window.location.search, projects, campaigns]);

  const [projectPage, setProjectPage] = useState(1);
  const [projectPageSize, setProjectPageSize] = useState(12);
  const [campaignPage, setCampaignPage] = useState(1);
  const [campaignPageSize, setCampaignPageSize] = useState(12);

  const filteredCampaigns = React.useMemo(() => {
    if (!campaignProjectFilter) return campaigns;
    return campaigns.filter(c => String(c.project_id) === String(campaignProjectFilter));
  }, [campaigns, campaignProjectFilter]);

  const paginatedCampaigns = React.useMemo(() => {
    const start = (campaignPage - 1) * campaignPageSize;
    return filteredCampaigns.slice(start, start + campaignPageSize);
  }, [filteredCampaigns, campaignPage, campaignPageSize]);

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
  const [teams, setTeams] = useState<any[]>([]);

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
  const [replyTo, setReplyTo] = useState<{ id: number; userName: string } | null>(null);
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
        body: JSON.stringify({ 
          body: newCommentText.trim(),
          parent_id: replyTo ? replyTo.id : null
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.success || res.id) {
        setNewCommentText('');
        setReplyTo(null);
        loadDetailComments(entityType, entityId);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const renderEntityComments = (entityType: 'project' | 'campaign', entityId: number) => {
    const rootComments = detailComments.filter((c: any) => !c.parent_id);
    const getReplies = (parentId: number) => {
      return detailComments
        .filter((c: any) => Number(c.parent_id) === Number(parentId))
        .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    };

    const renderSingleCommentNode = (comment: any, isReply: boolean = false) => {
      return (
        <div key={comment.id} id={`entity-comment-${comment.id}`} style={{ display: 'flex', gap: '8px', fontSize: '0.8125rem', paddingLeft: isReply ? '12px' : '0', borderLeft: isReply ? '2px solid var(--color-border-light)' : undefined, marginTop: isReply ? '6px' : '0' }}>
          <Avatar name={comment.user_name || 'User'} src={comment.avatar_url || undefined} size={isReply ? 20 : 24} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', background: isReply ? 'transparent' : 'var(--color-bg-light)', border: isReply ? 'none' : '1px solid var(--color-border-light)', padding: isReply ? '2px 0' : '8px 12px', borderRadius: isReply ? '0' : '12px', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, color: 'var(--color-text)' }}>{comment.user_name || 'Thành viên'}</span>
              <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>{comment.created_at ? new Date(comment.created_at).toLocaleString('vi-VN') : ''}</span>
            </div>
            <p style={{ margin: 0, color: 'var(--color-text-light)', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
              {comment.body}
            </p>
            {!isReply && (
              <button
                onClick={() => setReplyTo({ id: comment.id, userName: comment.user_name || 'Thành viên' })}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', fontSize: '0.7rem', padding: '4px 0 0 0', cursor: 'pointer', fontWeight: 700, textAlign: 'left', width: 'fit-content' }}
                className="hover-lift"
              >
                Phản hồi
              </button>
            )}
          </div>
        </div>
      );
    };

    return (
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
          {replyTo && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(163, 20, 34, 0.08)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.72rem', color: '#a31422', fontWeight: 700, marginBottom: '6px' }}>
              <span>Đang trả lời {replyTo.userName}</span>
              <button onClick={() => setReplyTo(null)} style={{ border: 'none', background: 'transparent', color: '#a31422', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem', padding: '0 4px' }}>×</button>
            </div>
          )}
          <MentionInput
            value={newCommentText}
            onChange={e => setNewCommentText(e.target.value)}
            placeholder="Viết bình luận... (Gõ @ để nhắc tên đồng nghiệp)"
            style={{ minHeight: '55px', fontSize: '0.85rem' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--color-border-light)', paddingTop: '8px', marginTop: '2px' }}>
            <button
              onClick={() => handlePostDetailComment(entityType, entityId)}
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
            rootComments.map((rootComment: any) => {
              const replies = getReplies(rootComment.id);
              return (
                <div key={rootComment.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {renderSingleCommentNode(rootComment, false)}
                  {replies.length > 0 && (
                    <div style={{ marginLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '6px', borderLeft: '1px solid var(--color-border-light)', paddingLeft: '8px', marginTop: '4px' }}>
                      {replies.map((reply: any) => renderSingleCommentNode(reply, true))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const loadLinkedTasks = async (entityType: 'project' | 'campaign', entityId: number) => {
    setLoadingLinkedTasks(true);
    try {
      const res = await fetchAPI(`activities?related_type=${entityType}&related_id=${entityId}&limit=100`);
      let directItems = [];
      if (res && res.items) {
        directItems = res.items;
      } else if (res.success && res.data && Array.isArray(res.data.items)) {
        directItems = res.data.items;
      } else if (res.data && Array.isArray(res.data)) {
        directItems = res.data;
      }

      if (entityType === 'campaign') {
        const parentProjId = editingCampaign?.project_id;
        if (parentProjId) {
          const projRes = await fetchAPI(`activities?related_type=project&related_id=${parentProjId}&limit=1000`);
          let projItems = [];
          if (projRes && projRes.items) {
            projItems = projRes.items;
          } else if (projRes.success && projRes.data && Array.isArray(projRes.data.items)) {
            projItems = projRes.data.items;
          } else if (projRes.data && Array.isArray(projRes.data)) {
            projItems = projRes.data;
          }

          const matchedProjItems = projItems.filter((task: any) => {
            if (task.body) {
              try {
                const parsed = JSON.parse(task.body);
                return Number(parsed?.erp_task?.campaign_id) === Number(entityId);
              } catch {
                return false;
              }
            }
            return false;
          });

          const allItems = [...directItems];
          matchedProjItems.forEach((task: any) => {
            if (!allItems.some(t => t.id === task.id)) {
              allItems.push(task);
            }
          });
          setLinkedTasks(allItems);
        } else {
          setLinkedTasks(directItems);
        }
      } else {
        setLinkedTasks(directItems);
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
      setProjectTasksPage(1);
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
      setCampaignTasksPage(1);
    } else {
      setCampaignStats(null);
      if (!editingProject) {
        setDetailComments([]);
        setLinkedTasks([]);
      }
    }
  }, [editingCampaign?.id]);

  useEffect(() => {
    const handleTaskUpdated = () => {
      if (editingProject && editingProject.id) {
        loadLinkedTasks('project', editingProject.id);
      }
      if (editingCampaign && editingCampaign.id) {
        loadLinkedTasks('campaign', editingCampaign.id);
      }
    };
    window.addEventListener('task-updated', handleTaskUpdated);
    return () => {
      window.removeEventListener('task-updated', handleTaskUpdated);
    };
  }, [editingProject?.id, editingCampaign?.id]);

  useEffect(() => {
    if (detailComments.length > 0 && (isEditModalOpen || isCampaignModalOpen)) {
      const params = new URLSearchParams(window.location.search);
      const highlightCommentId = params.get('highlight_comment_id');
      if (highlightCommentId) {
        setTimeout(() => {
          const element = document.getElementById(`project-comment-${highlightCommentId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Flash highlight comment bubble
            const bubble = element.querySelector('div') as HTMLElement;
            if (bubble) {
              const originalBg = bubble.style.background;
              bubble.style.backgroundColor = '#fef08a'; // yellow-200
              bubble.style.transition = 'all 0.5s ease';
              setTimeout(() => {
                bubble.style.background = originalBg;
              }, 2500);
            }
            
            // Clean URL parameters
            const newParams = new URLSearchParams(window.location.search);
            newParams.delete('highlight_comment_id');
            const cleanUrl = window.location.pathname + (newParams.toString() ? '?' + newParams.toString() : '');
            window.history.replaceState({}, '', cleanUrl);
          }
        }, 400);
      }
    }
  }, [detailComments, isEditModalOpen, isCampaignModalOpen]);

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
      if (camp?.project_id && Number(p.id) === Number(camp.project_id)) {
        return true;
      }
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
  const canEditRoster = React.useMemo(() => {
    if (!user) return false;
    if (['admin', 'superadmin', 'super_admin', 'director'].includes(user.role)) return true;
    
    const isManagerOrLeader = user.role === 'manager' || teams.some(t => Number(t.leader_id) === Number(user.id));
    if (isManagerOrLeader) {
      if (isRosterModalOpen && rosterMembers.length > 0) {
        return rosterMembers.some(m => Number(m.id) === Number(user.id) && m.is_assigned === 1);
      }
      return projectRoster.some((m: any) => Number(m.id) === Number(user.id));
    }
    return false;
  }, [user, teams, rosterMembers, projectRoster, isRosterModalOpen]);
  const isManagerOrLeader = React.useMemo(() => {
    if (!user) return false;
    return ['admin', 'superadmin', 'super_admin', 'director', 'manager'].includes(user.role) ||
           teams.some(t => Number(t.leader_id) === Number(user.id));
  }, [user, teams]);

  const canEditProject = (proj: Project) => {
    if (!user) return false;
    if (isSystemAdmin || ['admin', 'superadmin', 'super_admin', 'director'].includes(user.role)) return true;
    const isManagerOrLeaderUser = user.role === 'manager' || teams.some(t => Number(t.leader_id) === Number(user.id));
    if (isManagerOrLeaderUser) return true;
    return String(proj.created_by) === String(user.id);
  };

  const canDeleteProject = (proj: Project) => {
    if (!user) return false;
    if (isSystemAdmin || user.role === 'director') return true;
    return String(proj.created_by) === String(user.id);
  };

  const canEditCampaign = (camp: any) => {
    if (!user) return false;
    if (isSystemAdmin || ['admin', 'superadmin', 'super_admin', 'director'].includes(user.role)) return true;
    
    // Bypass if user is the project manager or creator of the parent project
    if (camp.project_id) {
      const parentProj = projects.find(p => String(p.id) === String(camp.project_id));
      if (parentProj) {
        const isProjCreator = String(parentProj.created_by) === String(user.id);
        const isProjMgr = parentProj.manager_ids && parentProj.manager_ids.split(',').map(s => s.trim()).includes(String(user.id));
        if (isProjCreator || isProjMgr) return true;
      }
    }

    const isManagerOrLeaderUser = user.role === 'manager' || teams.some(t => Number(t.leader_id) === Number(user.id));
    if (isManagerOrLeaderUser) return true;
    const isCreator = String(camp.created_by) === String(user.id);
    const inManagerIds = camp.manager_ids && camp.manager_ids.split(',').map(String).includes(String(user.id));
    const inUserIds = camp.user_ids && camp.user_ids.split(',').map(String).includes(String(user.id));
    return isCreator || inManagerIds || inUserIds;
  };

  const canDeleteCampaign = (camp: any) => {
    if (!user) return false;
    if (isSystemAdmin || ['admin', 'superadmin', 'super_admin', 'director'].includes(user.role)) return true;

    // Bypass if user is the project manager or creator of the parent project
    if (camp.project_id) {
      const parentProj = projects.find(p => String(p.id) === String(camp.project_id));
      if (parentProj) {
        const isProjCreator = String(parentProj.created_by) === String(user.id);
        const isProjMgr = parentProj.manager_ids && parentProj.manager_ids.split(',').map(s => s.trim()).includes(String(user.id));
        if (isProjCreator || isProjMgr) return true;
      }
    }

    return String(camp.created_by) === String(user.id);
  };

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
        const cleanName = (n: string) => (n || '').trim().replace(/\s+/g, '_').toLowerCase().replace(/_\([^)]+\)/g, '').replace(/\([^)]+\)/g, '');
        const cleanMentionVal = cleanName(part.substring(1));
        const taggedUser = users.find((u: any) => {
          const normalizedUser = cleanName(u.full_name || u.name || u.fullname || u.username);
          return normalizedUser === cleanMentionVal;
        });

        const displayName = taggedUser?.full_name || taggedUser?.name || taggedUser?.fullname || taggedUser?.username || part.substring(1).replace(/_/g, ' ');
        const avatarUrl = taggedUser?.avatar_url || taggedUser?.avatar;
        const initial = displayName ? displayName.charAt(0).toUpperCase() : '?';

        return (
          <span
            key={index}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              color: '#dc2626',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              padding: '2px 8px',
              borderRadius: '9999px',
              margin: '0 2px',
              fontWeight: 600,
              fontSize: '0.85em',
              verticalAlign: 'middle'
            }}
          >
            <Avatar name={displayName} src={avatarUrl} size={16} />
            @{displayName}
          </span>
        );
      }
      return part;
    });
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
    if (!path) return <span style={{ color: 'var(--color-text-light)', fontStyle: 'italic', fontSize: '0.85rem' }}>Không có folder liên kết</span>;
    const isUrl = path.startsWith('http://') || path.startsWith('https://');
    if (isUrl) {
      const isDriveUrl = path.toLowerCase().includes('drive');
      return (
        <a 
          href={path} 
          target="_blank" 
          rel="noopener noreferrer" 
          style={{ 
            color: '#64748b', 
            textDecoration: 'none', 
            fontWeight: 700, 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '8px',
            background: 'rgba(100, 116, 139, 0.05)',
            border: '1px solid rgba(100, 116, 139, 0.12)',
            padding: '6px 12px',
            borderRadius: '10px',
            fontSize: '0.825rem',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(100, 116, 139, 0.08)';
            e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.2)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(100, 116, 139, 0.05)';
            e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.12)';
          }}
        >
          {isDriveUrl ? (
            <>
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Google_Drive_icon_%282020%29.svg/1280px-Google_Drive_icon_%282020%29.svg.png" 
                alt="Google Drive" 
                style={{ width: '14px', height: '14px', objectFit: 'contain', flexShrink: 0 }} 
              />
              <span>Mở Google Drive</span>
            </>
          ) : (
            <>
              <ExternalLink size={14} color="#3b82f6" style={{ flexShrink: 0 }} />
              <span>Mở liên kết</span>
            </>
          )}
        </a>
      );
    }
    
    return (
      <button 
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (projectId) {
            handleOpenFolderModal(path, projectId);
          } else {
            addToast('Không tìm thấy dự án liên kết', 'error');
          }
        }}
        style={{ 
          color: '#64748b', 
          border: '1px solid rgba(100, 116, 139, 0.12)',
          background: 'rgba(100, 116, 139, 0.05)',
          cursor: 'pointer',
          fontWeight: 700, 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '8px',
          padding: '6px 12px',
          borderRadius: '10px',
          fontSize: '0.825rem',
          transition: 'all 0.2s ease',
          outline: 'none'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(100, 116, 139, 0.08)';
          e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.2)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(100, 116, 139, 0.05)';
          e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.12)';
        }}
      >
        <Folder size={14} color="#f59e0b" fill="#f59e0b" />
        <span>{path}</span>
      </button>
    );
  };

  const renderProjectViewDrawer = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
        {projectDrawerTab === 'details' ? (
          <>
            {/* KPI Summary Cards */}
            {projectStats && (
              <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '0.5rem' }}>
                {/* 1. Tổng Khách Hàng */}
                <div 
                  className="stat-card" 
                  onClick={user && ['admin', 'superadmin', 'super_admin', 'director'].includes(user.role) ? () => {
                    if (editingProject?.id) {
                      navigate(`/contacts?project_id=${editingProject.id}`);
                    }
                  } : undefined}
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    padding: '0.75rem 1rem', 
                    background: '#ffffff', 
                    border: '1px solid var(--color-border-light)', 
                    borderRadius: '12px', 
                    boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
                    cursor: user && ['admin', 'superadmin', 'super_admin', 'director'].includes(user.role) ? 'pointer' : 'default',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={user && ['admin', 'superadmin', 'super_admin', 'director'].includes(user.role) ? e => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.04)';
                    e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                  } : undefined}
                  onMouseLeave={user && ['admin', 'superadmin', 'super_admin', 'director'].includes(user.role) ? e => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.02)';
                    e.currentTarget.style.borderColor = 'var(--color-border-light)';
                  } : undefined}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-muted)', opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tổng Khách Hàng</span>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(100, 116, 139, 0.08)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={14} /></div>
                  </div>
                  <div>
                    <div className="stat-value" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1 }}>
                      {projectStats.total_leads}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-light)', marginTop: '4px', fontWeight: 550 }}>Khách hàng tiềm năng</div>
                  </div>
                </div>

                {/* 2. Cơ Hội Bán Hàng */}
                <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', padding: '0.75rem 1rem', background: '#ffffff', border: '1px solid var(--color-border-light)', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-muted)', opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cơ Hội Bán Hàng</span>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(100, 116, 139, 0.08)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Layers size={14} /></div>
                  </div>
                  <div>
                    <div className="stat-value" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1 }}>
                      {projectStats.total_deals}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-light)', marginTop: '4px', fontWeight: 550 }}>Cơ cơ hội giao dịch</div>
                  </div>
                </div>

                {/* 3. Doanh Thu */}
                <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', padding: '0.75rem 1rem', background: '#ffffff', border: '1px solid var(--color-border-light)', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-muted)', opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Doanh Thu</span>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(100, 116, 139, 0.08)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Building2 size={14} /></div>
                  </div>
                  <div>
                    <div className="stat-value" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={projectStats.actual_revenue.toLocaleString('vi-VN') + ' VND'}>
                      {projectStats.actual_revenue >= 1000000000 
                        ? `${(projectStats.actual_revenue / 1000000000).toFixed(2)} tỷ` 
                        : `${(projectStats.actual_revenue / 1000000).toFixed(0)} triệu`}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-light)', marginTop: '4px', fontWeight: 550 }}>Từ hóa đơn thực tế</div>
                  </div>
                </div>

                {/* 4. Tỷ Lệ Chốt */}
                <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', padding: '0.75rem 1rem', background: '#ffffff', border: '1px solid var(--color-border-light)', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-muted)', opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tỷ Lệ Chốt</span>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(100, 116, 139, 0.08)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckSquare size={14} /></div>
                  </div>
                  <div>
                    <div className="stat-value" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1 }}>
                      {projectStats.win_rate}%
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-light)', marginTop: '4px', fontWeight: 550 }}>Tỷ lệ giao dịch thành công</div>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '1.25rem', alignItems: 'start' }}>
              {/* Left Column (3/5) */}
              <div style={{ flex: 3, width: isMobile ? '100%' : 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* Section 1: Thông tin cơ bản */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  boxShadow: '0 10px 30px -10px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      padding: '8px',
                      background: 'rgba(100, 116, 139, 0.08)',
                      borderRadius: '10px',
                      color: 'var(--color-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Building2 size={16} />
                    </div>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Thông tin cơ bản</h4>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Tên dự án</span>
                      <span style={{ color: 'var(--color-text)', fontSize: '0.95rem', fontWeight: 700, display: 'block' }}>{editingProject?.name}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Mã dự án</span>
                      <span style={{ color: 'var(--color-text)', fontSize: '0.95rem', fontWeight: 700, display: 'block', fontFamily: 'monospace' }}>{editingProject?.code}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Chủ đầu tư</span>
                      <span style={{ color: 'var(--color-text)', fontSize: '0.95rem', fontWeight: 700, display: 'block' }}>{editingProject?.developer || 'Chưa cập nhật'}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Trạng thái bán</span>
                      <span 
                        className={`badge ${editingProject?.status === 'active' ? 'success' : 'secondary'}`}
                        style={{ fontSize: '0.75rem', padding: '6px 12px', borderRadius: '100px', fontWeight: 700, display: 'inline-block', marginTop: '2px' }}
                      >
                        {editingProject?.status === 'active' ? 'Đang mở bán' : 'Tạm dừng bán'}
                      </span>
                    </div>
                    {editingProject?.reference_url && parseReferenceLinks(editingProject.reference_url).length > 0 && (
                      <div style={{ gridColumn: 'span 2', marginTop: '4px', borderTop: '1px solid var(--color-border-light)', paddingTop: '12px' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Website &amp; Tài liệu tham khảo</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {parseReferenceLinks(editingProject.reference_url).map((link, idx) => {
                            if (!link.url) return null;
                            const isGoogleSheets = link.url.includes('docs.google.com/spreadsheets') || link.url.includes('google.com/sheets');
                            return (
                              <a
                                key={idx}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  background: isGoogleSheets ? 'rgba(16, 185, 129, 0.05)' : 'rgba(100, 116, 139, 0.05)',
                                  border: isGoogleSheets ? '1px solid rgba(16, 185, 129, 0.1)' : '1px solid rgba(100, 116, 139, 0.12)',
                                  padding: '8px 14px',
                                  borderRadius: '12px',
                                  color: isGoogleSheets ? '#10b981' : '#64748b',
                                  textDecoration: 'none',
                                  fontWeight: 700,
                                  fontSize: '0.825rem',
                                  transition: 'all 0.2s ease',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.background = isGoogleSheets ? 'rgba(16, 185, 129, 0.1)' : 'rgba(100, 116, 139, 0.08)';
                                  e.currentTarget.style.borderColor = isGoogleSheets ? 'rgba(16, 185, 129, 0.2)' : 'rgba(100, 116, 139, 0.2)';
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.background = isGoogleSheets ? 'rgba(16, 185, 129, 0.05)' : 'rgba(100, 116, 139, 0.05)';
                                  e.currentTarget.style.borderColor = isGoogleSheets ? '1px solid rgba(16, 185, 129, 0.1)' : 'rgba(100, 116, 139, 0.12)';
                                }}
                              >
                                {isGoogleSheets ? (
                                  <FileSpreadsheet size={14} color="#10b981" />
                                ) : (
                                  <Globe size={14} />
                                )}
                                <span>{link.title}</span>
                                <ExternalLink size={12} style={{ opacity: 0.6 }} />
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 2: Vị trí & Quy mô & Pháp lý */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  boxShadow: '0 10px 30px -10px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      padding: '8px',
                      background: 'rgba(100, 116, 139, 0.08)',
                      borderRadius: '10px',
                      color: 'var(--color-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <MapPin size={16} />
                    </div>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vị trí, Quy mô & Pháp lý</h4>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Vị trí / Địa chỉ</span>
                      <span style={{ color: 'var(--color-text)', fontSize: '0.85rem', fontWeight: 700, display: 'block', lineHeight: 1.4 }}>{editingProject?.location || 'Chưa cập nhật'}</span>
                    </div>
                    
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Trạng thái thi công &amp; Tiến độ</span>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '6px' }}>
                        <span style={{ color: 'var(--color-text)', fontSize: '0.95rem', fontWeight: 700 }}>
                          {editingProject?.construction_status || 'Chưa khởi công'}
                        </span>
                        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: (editingProject?.progress_percent ?? 0) === 100 ? 'var(--color-success)' : 'var(--color-primary)' }}>
                          {editingProject?.progress_percent ?? 0}%
                        </span>
                      </div>
                      
                      {/* Beautiful progress bar */}
                      <div style={{ height: '8px', background: 'var(--color-border-light)', borderRadius: '99px', overflow: 'hidden', width: '100%' }}>
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
                      <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cột mốc dự án (Milestones)</span>
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
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Trạng thái pháp lý</span>
                      <span style={{ color: 'var(--color-text)', fontSize: '0.95rem', fontWeight: 700, display: 'block' }}>{editingProject?.legal_status || 'Đang hoàn thiện pháp lý'}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Năm bàn giao dự kiến</span>
                      <span style={{ color: 'var(--color-text)', fontSize: '0.95rem', fontWeight: 700, display: 'block' }}>{editingProject?.handover_year || 2026}</span>
                    </div>

                  </div>
                </div>

                {/* Section 4: Mô tả chi tiết */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  boxShadow: '0 10px 30px -10px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      padding: '8px',
                      background: 'rgba(100, 116, 139, 0.08)',
                      borderRadius: '10px',
                      color: 'var(--color-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <AlignLeft size={16} />
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mô tả chi tiết</span>
                  </div>
                  <p style={{ color: 'var(--color-text)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '0.875rem' }}>
                    {editingProject?.description || 'Không có mô tả chi tiết'}
                  </p>
                </div>

                {/* Discussions/Comments */}
                {editingProject && renderEntityComments('project', editingProject.id)}

              </div>

              {/* Right Column (2/5) */}
              <div style={{ flex: 2, width: isMobile ? '100%' : 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* Section 3: Nhân sự & Tài liệu */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  boxShadow: '0 10px 30px -10px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      padding: '8px',
                      background: 'rgba(100, 116, 139, 0.08)',
                      borderRadius: '10px',
                      color: 'var(--color-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Users size={16} />
                    </div>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quản lý &amp; Nhân sự</h4>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Manager phụ trách chính</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {parseIds(editingProject?.manager_ids).length === 0 ? (
                          <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>Chưa phân công manager phụ trách</span>
                        ) : (
                          parseIds(editingProject?.manager_ids).map(id => {
                            const u = users.find(usr => String(usr.id) === String(id));
                            if (!u) return null;
                            return (
                              <span key={id} style={{ background: 'var(--color-bg-light)', border: '1px solid var(--color-border-light)', padding: '6px 12px', borderRadius: '100px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text)', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                <Avatar src={u.avatar_url || u.avatar} name={u.full_name || u.fullname || u.username} size={20} />
                                {u.full_name || u.fullname || u.username}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>
                    <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '1.25rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Đội ngũ nhân sự phụ trách</span>
                      {projectRosterLoading ? (
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Đang tải danh sách nhân sự...</span>
                      ) : projectRoster.length === 0 ? (
                        <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>Chưa phân công nhân sự</span>
                      ) : (
                        <div 
                          onClick={() => setShowRosterModal(true)}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            padding: '6px 12px', 
                            background: 'var(--color-bg-light)', 
                            border: '1px solid var(--color-border-light)', 
                            borderRadius: '12px', 
                            cursor: 'pointer', 
                            width: 'fit-content', 
                            transition: 'all 0.2s ease' 
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                            e.currentTarget.style.background = 'rgba(163, 20, 34, 0.02)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'var(--color-border-light)';
                            e.currentTarget.style.background = 'var(--color-bg-light)';
                          }}
                          title="Click để xem danh sách nhân sự chi tiết"
                        >
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            {projectRoster.slice(0, 5).map((member: any, idx: number) => (
                              <div 
                                key={member.id} 
                                style={{ 
                                  marginLeft: idx === 0 ? 0 : -8, 
                                  border: '2px solid var(--color-surface)', 
                                  borderRadius: '50%',
                                  overflow: 'hidden',
                                  boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
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
                                  boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                                  zIndex: 5
                                }}
                              >
                                +{projectRoster.length - 5}
                              </div>
                            )}
                          </div>
                          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-muted)', marginLeft: '10px' }}>
                            ({projectRoster.length} nhân sự)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section: Chiến dịch liên kết */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  boxShadow: '0 10px 30px -10px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      padding: '8px',
                      background: 'rgba(100, 116, 139, 0.08)',
                      borderRadius: '10px',
                      color: 'var(--color-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Megaphone size={16} />
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Chiến dịch liên kết</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(() => {
                      const linkedCamps = campaigns.filter(c => 
                        String(c.project_id) === String(editingProject?.id) || 
                        (editingProject?.campaign_ids && editingProject.campaign_ids.split(',').map((s: string) => s.trim()).includes(c.name))
                      );

                      if (linkedCamps.length === 0) {
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#f3f4f6', border: '1px solid var(--color-border-light)', borderRadius: '12px', color: '#6b7280', fontSize: '0.8rem', fontWeight: 550, cursor: 'not-allowed' }}>
                            <Info size={12} style={{ opacity: 0.6 }} />
                            <span>Chưa liên kết chiến dịch</span>
                          </div>
                        );
                      }

                      return (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {linkedCamps.map(camp => (
                            <span
                              key={camp.id}
                              onClick={() => handleOpenCampaignView(camp)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '0.825rem',
                                fontWeight: 700,
                                background: 'rgba(100, 116, 139, 0.05)',
                                padding: '6px 12px',
                                borderRadius: '10px',
                                border: '1px solid rgba(100, 116, 139, 0.12)',
                                color: '#64748b',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.2)';
                                e.currentTarget.style.background = 'rgba(100, 116, 139, 0.08)';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.12)';
                                e.currentTarget.style.background = 'rgba(100, 116, 139, 0.05)';
                              }}
                            >
                              <Megaphone size={14} color="var(--color-primary)" style={{ flexShrink: 0 }} />
                              {camp.name}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Section: Đường dẫn Folder liên kết */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  boxShadow: '0 10px 30px -10px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      padding: '8px',
                      background: 'rgba(100, 116, 139, 0.08)',
                      borderRadius: '10px',
                      color: 'var(--color-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Folder size={16} />
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Đường dẫn Folder liên kết</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {parseFolderPaths(editingProject?.folder_path).length === 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#f3f4f6', border: '1px solid var(--color-border-light)', borderRadius: '12px', color: '#6b7280', fontSize: '0.8rem', fontWeight: 550, cursor: 'not-allowed' }}>
                        <Info size={12} style={{ opacity: 0.6 }} />
                        <span>Chưa cấu hình folder liên kết</span>
                      </div>
                    ) : (
                      parseFolderPaths(editingProject?.folder_path).map((f, idx) => (
                        <div key={idx}>
                          {renderFolderPathLink(f.path, editingProject?.id)}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Section: Tài liệu liên kết */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  boxShadow: '0 10px 30px -10px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      padding: '8px',
                      background: 'rgba(100, 116, 139, 0.08)',
                      borderRadius: '10px',
                      color: 'var(--color-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <FileText size={16} />
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tài liệu liên kết</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {parseIds(editingProject?.document_ids).length === 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#f3f4f6', border: '1px solid var(--color-border-light)', borderRadius: '12px', color: '#6b7280', fontSize: '0.8rem', fontWeight: 550, cursor: 'not-allowed' }}>
                        <Info size={12} style={{ opacity: 0.6 }} />
                        <span>Chưa liên kết tài liệu</span>
                      </div>
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
                            style={{ 
                              color: '#64748b', 
                              textDecoration: 'none', 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '8px', 
                              fontSize: '0.8rem', 
                              fontWeight: 700,
                              background: 'var(--color-bg-light)',
                              padding: '8px 12px',
                              borderRadius: '10px',
                              border: '1px solid var(--color-border-light)',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.2)';
                              e.currentTarget.style.background = '#ffffff';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.borderColor = 'var(--color-border-light)';
                              e.currentTarget.style.background = 'var(--color-bg-light)';
                            }}
                          >
                            <FileText size={14} color="#3b82f6" style={{ flexShrink: 0 }} /> {formatFileName(fileObj.name, 40)}
                          </a>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Linked Tasks */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  boxShadow: '0 10px 30px -10px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      padding: '8px',
                      background: 'rgba(100, 116, 139, 0.08)',
                      borderRadius: '10px',
                      color: 'var(--color-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <CheckSquare size={16} />
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Nhiệm vụ & Công việc liên kết ({linkedTasks.length})
                    </span>
                  </div>
                  {loadingLinkedTasks ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
                      <RefreshCw className="spin" size={16} color="var(--color-text-muted)" />
                    </div>
                  ) : linkedTasks.length === 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#f3f4f6', border: '1px solid var(--color-border-light)', borderRadius: '12px', color: '#6b7280', fontSize: '0.8rem', fontWeight: 550, cursor: 'not-allowed' }}>
                      <Info size={12} style={{ opacity: 0.6 }} />
                      <span>Chưa có công việc nào liên kết với dự án này.</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(() => {
                        const priorityWeight: Record<string, number> = {
                          high: 3,
                          medium: 2,
                          low: 1
                        };
                        const getPriorityWeight = (p: string) => priorityWeight[p] || 2;

                        const sortedTasks = [...linkedTasks].sort((a, b) => {
                          const weightA = getPriorityWeight(a.priority);
                          const weightB = getPriorityWeight(b.priority);
                          if (weightB !== weightA) {
                            return weightB - weightA;
                          }
                          if (a.due_date && b.due_date) {
                            return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
                          }
                          if (a.due_date) return -1;
                          if (b.due_date) return 1;
                          return 0;
                        });

                        const totalPages = Math.ceil(sortedTasks.length / 10);
                        const startIndex = (projectTasksPage - 1) * 10;
                        const paginatedTasks = sortedTasks.slice(startIndex, startIndex + 10);

                        return (
                          <>
                            {paginatedTasks.map(task => {
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
                                    padding: '12px 16px',
                                    borderRadius: '12px',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.01)'
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                                    e.currentTarget.style.background = '#ffffff';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(163, 20, 34, 0.06)';
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.borderColor = 'var(--color-border-light)';
                                    e.currentTarget.style.background = 'var(--color-bg-light)';
                                    e.currentTarget.style.transform = 'none';
                                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.01)';
                                  }}
                                  onClick={() => handleOpenTask(task.id)}
                                  title={t('Click để xem chi tiết nhiệm vụ')}
                                >
                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{ marginTop: '3px' }}>
                                      <CheckSquare size={18} color={task.status === 'done' ? 'var(--color-success)' : 'var(--color-text-muted)'} style={{ opacity: 0.85 }} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <span style={{ fontWeight: 650, color: 'var(--color-text)', fontSize: '0.9rem', lineHeight: '1.2' }}>{task.subject}</span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Avatar 
                                          src={performer?.avatar_url || performer?.avatar} 
                                          name={performer?.full_name || performer?.name || 'Hệ thống'} 
                                          size={18} 
                                        />
                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                                          {performer?.full_name || 'Hệ thống'} {performer?.role ? `(${performer.role})` : ''}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <span style={{ 
                                    fontSize: '0.72rem', 
                                    fontWeight: 700, 
                                    padding: '4px 10px', 
                                    borderRadius: '100px', 
                                    background: sc.bg, 
                                    color: sc.text,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.03em'
                                  }}>
                                    {task.status === 'done' ? 'Đã xong' : 'Chưa xong'}
                                  </span>
                                </div>
                              );
                            })}

                            {totalPages > 1 && (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '1rem' }}>
                                <button
                                  disabled={projectTasksPage === 1}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setProjectTasksPage(p => Math.max(1, p - 1));
                                  }}
                                  style={{
                                    background: '#ffffff',
                                    border: '1px solid var(--color-border-light)',
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: projectTasksPage === 1 ? 'not-allowed' : 'pointer',
                                    opacity: projectTasksPage === 1 ? 0.5 : 1,
                                    color: 'var(--color-text)'
                                  }}
                                >
                                  Trước
                                </button>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                                  Trang {projectTasksPage} / {totalPages}
                                </span>
                                <button
                                  disabled={projectTasksPage === totalPages}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setProjectTasksPage(p => Math.min(totalPages, p + 1));
                                  }}
                                  style={{
                                    background: '#ffffff',
                                    border: '1px solid var(--color-border-light)',
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: projectTasksPage === totalPages ? 'not-allowed' : 'pointer',
                                    opacity: projectTasksPage === totalPages ? 0.5 : 1,
                                    color: 'var(--color-text)'
                                  }}
                                >
                                  Sau
                                </button>
                              </div>
                            )}
                          </>
                        );
                      })()}
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
        {campaignDrawerTab === 'details' ? (
          <>
            {/* KPI Summary Cards */}
            {campaignStats && (
              <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {/* 1. Tổng Khách Hàng */}
                <div 
                  className="stat-card" 
                  onClick={user && ['admin', 'superadmin', 'super_admin', 'director'].includes(user.role) ? () => {
                    if (editingCampaign?.id) {
                      navigate(`/contacts?campaign_id=${editingCampaign.id}`);
                    }
                  } : undefined}
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    padding: '0.75rem 1rem', 
                    background: '#ffffff', 
                    border: '1px solid var(--color-border-light)', 
                    borderRadius: '12px', 
                    boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
                    cursor: user && ['admin', 'superadmin', 'super_admin', 'director'].includes(user.role) ? 'pointer' : 'default',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={user && ['admin', 'superadmin', 'super_admin', 'director'].includes(user.role) ? e => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.04)';
                    e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                  } : undefined}
                  onMouseLeave={user && ['admin', 'superadmin', 'super_admin', 'director'].includes(user.role) ? e => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.02)';
                    e.currentTarget.style.borderColor = 'var(--color-border-light)';
                  } : undefined}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-muted)', opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tổng Khách Hàng</span>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(100, 116, 139, 0.08)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={14} /></div>
                  </div>
                  <div>
                    <div className="stat-value" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1 }}>
                      {campaignStats.total_leads}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-light)', marginTop: '4px', fontWeight: 550 }}>Khách hàng tiềm năng</div>
                  </div>
                </div>

                {/* 2. Cơ Hội Bán Hàng */}
                <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', padding: '0.75rem 1rem', background: '#ffffff', border: '1px solid var(--color-border-light)', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-muted)', opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cơ Hội Bán Hàng</span>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(100, 116, 139, 0.08)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Layers size={14} /></div>
                  </div>
                  <div>
                    <div className="stat-value" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1 }}>
                      {campaignStats.converted_leads}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-light)', marginTop: '4px', fontWeight: 550 }}>Cơ hội giao dịch</div>
                  </div>
                </div>

                {/* 3. Doanh Thu */}
                <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', padding: '0.75rem 1rem', background: '#ffffff', border: '1px solid var(--color-border-light)', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-muted)', opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Doanh Thu</span>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(100, 116, 139, 0.08)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Building2 size={14} /></div>
                  </div>
                  <div>
                    <div className="stat-value" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={campaignStats.actual_revenue.toLocaleString('vi-VN') + ' VND'}>
                      {campaignStats.actual_revenue >= 1000000000 
                        ? `${(campaignStats.actual_revenue / 1000000000).toFixed(2)} tỷ` 
                        : `${(campaignStats.actual_revenue / 1000000).toFixed(0)} triệu`}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-light)', marginTop: '4px', fontWeight: 550 }}>Từ hóa đơn thực tế</div>
                  </div>
                </div>

                {/* 4. Tỷ Lệ Chốt */}
                <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', padding: '0.75rem 1rem', background: '#ffffff', border: '1px solid var(--color-border-light)', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-muted)', opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tỷ Lệ Chốt</span>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(100, 116, 139, 0.08)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckSquare size={14} /></div>
                  </div>
                  <div>
                    <div className="stat-value" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1 }}>
                      {campaignStats.conversion_rate}%
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-light)', marginTop: '4px', fontWeight: 550 }}>Tỷ lệ giao dịch thành công</div>
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
                    <div style={{ width: '3px', height: '14px', background: 'var(--color-text-muted)', borderRadius: '1.5px', flexShrink: 0 }} />
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
                        {renderFolderPathLink(editingCampaign?.folder_path, editingCampaign?.project_id)}
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
                {editingCampaign && renderEntityComments('campaign', editingCampaign.id)}

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
                    <div style={{ width: '3px', height: '14px', background: 'var(--color-text-muted)', borderRadius: '1.5px', flexShrink: 0 }} />
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dự án &amp; Nhân sự phụ trách</h4>
                  </div>
                  
                  {(() => {
                    const associatedProjs = editingCampaign?.project_id 
                      ? projects.filter(p => p.id === editingCampaign.project_id)
                      : projects.filter(p => {
                          const campIds = p.campaign_ids ? p.campaign_ids.split(',').map((id: string) => id.trim()) : [];
                          return campIds.includes(editingCampaign?.name);
                        });

                    const campaignManagers = parseIds(editingCampaign?.manager_ids).map(id => users.find(u => Number(u.id) === Number(id))).filter(Boolean);
                    const campaignStaff = parseIds(editingCampaign?.user_ids).map(id => users.find(u => Number(u.id) === Number(id))).filter(Boolean);

                    if (associatedProjs.length === 0) {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <div style={{ padding: '1rem', background: 'var(--color-bg-light)', border: '1px dashed var(--color-border)', borderRadius: '12px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: '1rem' }}>
                            Chưa liên kết dự án nào
                          </div>

                          <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Manager phụ trách chiến dịch:</span>
                            {campaignManagers.length === 0 ? (
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontStyle: 'italic' }}>Chưa phân công manager</span>
                            ) : (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {campaignManagers.map((member: any) => (
                                  <span key={member.id} style={{ background: '#ffffff', border: '1px solid var(--color-border)', padding: '2px 8px', borderRadius: '100px', fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <Avatar src={member.avatar_url || member.avatar} name={member.full_name || member.fullname || member.name || member.username} size={16} />
                                    {member.full_name || member.fullname || member.name || member.username}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div style={{ marginTop: '1rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Nhân sự phụ trách chiến dịch:</span>
                            {campaignStaff.length === 0 ? (
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontStyle: 'italic' }}>Chưa phân công nhân sự</span>
                            ) : (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {campaignStaff.map((member: any) => (
                                  <span key={member.id} style={{ background: '#ffffff', border: '1px solid var(--color-border)', padding: '2px 8px', borderRadius: '100px', fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <Avatar src={member.avatar_url || member.avatar} name={member.full_name || member.fullname || member.name || member.username} size={16} />
                                    {member.full_name || member.fullname || member.name || member.username}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {associatedProjs.map(proj => {
                          const projManagers = parseIds(proj.manager_ids).map(id => users.find(u => Number(u.id) === Number(id))).filter(Boolean);

                          return (
                            <div key={proj.id} style={{ border: '1px solid var(--color-border-light)', borderRadius: '12px', padding: '1rem', background: 'var(--color-bg-light)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dotted var(--color-border-light)', paddingBottom: '0.5rem' }}>
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

                              <div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Quản lý dự án:</span>
                                {projManagers.length === 0 ? (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontStyle: 'italic' }}>Chưa phân công quản lý</span>
                                ) : (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {projManagers.map((member: any) => (
                                      <span key={member.id} style={{ background: '#ffffff', border: '1px solid var(--color-border)', padding: '2px 8px', borderRadius: '100px', fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <Avatar src={member.avatar_url || member.avatar} name={member.full_name || member.fullname || member.name || member.username} size={16} />
                                        {member.full_name || member.fullname || member.name || member.username}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                          <div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Manager phụ trách chiến dịch:</span>
                            {campaignManagers.length === 0 ? (
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontStyle: 'italic' }}>Chưa phân công manager</span>
                            ) : (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {campaignManagers.map((member: any) => (
                                  <span key={member.id} style={{ background: '#ffffff', border: '1px solid var(--color-border)', padding: '2px 8px', borderRadius: '100px', fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <Avatar src={member.avatar_url || member.avatar} name={member.full_name || member.fullname || member.name || member.username} size={16} />
                                    {member.full_name || member.fullname || member.name || member.username}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Nhân sự phụ trách chiến dịch:</span>
                            {campaignStaff.length === 0 ? (
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontStyle: 'italic' }}>Chưa phân công nhân sự</span>
                            ) : (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {campaignStaff.map((member: any) => (
                                  <span key={member.id} style={{ background: '#ffffff', border: '1px solid var(--color-border)', padding: '2px 8px', borderRadius: '100px', fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <Avatar src={member.avatar_url || member.avatar} name={member.full_name || member.fullname || member.name || member.username} size={16} />
                                    {member.full_name || member.fullname || member.name || member.username}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
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
                      {(() => {
                        const priorityWeight: Record<string, number> = {
                          high: 3,
                          medium: 2,
                          low: 1
                        };
                        const getPriorityWeight = (p: string) => priorityWeight[p] || 2;

                        const sortedTasks = [...linkedTasks].sort((a, b) => {
                          const weightA = getPriorityWeight(a.priority);
                          const weightB = getPriorityWeight(b.priority);
                          if (weightB !== weightA) {
                            return weightB - weightA;
                          }
                          if (a.due_date && b.due_date) {
                            return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
                          }
                          if (a.due_date) return -1;
                          if (b.due_date) return 1;
                          return 0;
                        });

                        const totalPages = Math.ceil(sortedTasks.length / 10);
                        const startIndex = (campaignTasksPage - 1) * 10;
                        const paginatedTasks = sortedTasks.slice(startIndex, startIndex + 10);

                        return (
                          <>
                            {paginatedTasks.map(task => {
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
                                    padding: '12px 16px',
                                    borderRadius: '12px',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.01)'
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                                    e.currentTarget.style.background = '#ffffff';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(163, 20, 34, 0.06)';
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.borderColor = 'var(--color-border-light)';
                                    e.currentTarget.style.background = 'var(--color-bg-light)';
                                    e.currentTarget.style.transform = 'none';
                                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.01)';
                                  }}
                                  onClick={() => handleOpenTask(task.id)}
                                  title={t('Click để xem chi tiết nhiệm vụ')}
                                >
                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{ marginTop: '3px' }}>
                                      <CheckSquare size={18} color={task.status === 'done' ? 'var(--color-success)' : 'var(--color-text-muted)'} style={{ opacity: 0.85 }} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <span style={{ fontWeight: 650, color: 'var(--color-text)', fontSize: '0.9rem', lineHeight: '1.2' }}>{task.subject}</span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Avatar 
                                          src={performer?.avatar_url || performer?.avatar} 
                                          name={performer?.full_name || performer?.name || 'Hệ thống'} 
                                          size={18} 
                                        />
                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                                          {performer?.full_name || 'Hệ thống'} {performer?.role ? `(${performer.role})` : ''}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <span style={{ 
                                    fontSize: '0.72rem', 
                                    fontWeight: 700, 
                                    padding: '4px 10px', 
                                    borderRadius: '100px', 
                                    background: sc.bg, 
                                    color: sc.text,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.03em'
                                  }}>
                                    {task.status === 'done' ? 'Đã xong' : 'Chưa xong'}
                                  </span>
                                </div>
                              );
                            })}

                            {totalPages > 1 && (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '1rem' }}>
                                <button
                                  disabled={campaignTasksPage === 1}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCampaignTasksPage(p => Math.max(1, p - 1));
                                  }}
                                  style={{
                                    background: '#ffffff',
                                    border: '1px solid var(--color-border-light)',
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: campaignTasksPage === 1 ? 'not-allowed' : 'pointer',
                                    opacity: campaignTasksPage === 1 ? 0.5 : 1,
                                    color: 'var(--color-text)'
                                  }}
                                >
                                  Trước
                                </button>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                                  Trang {campaignTasksPage} / {totalPages}
                                </span>
                                <button
                                  disabled={campaignTasksPage === totalPages}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCampaignTasksPage(p => Math.min(totalPages, p + 1));
                                  }}
                                  style={{
                                    background: '#ffffff',
                                    border: '1px solid var(--color-border-light)',
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: campaignTasksPage === totalPages ? 'not-allowed' : 'pointer',
                                    opacity: campaignTasksPage === totalPages ? 0.5 : 1,
                                    color: 'var(--color-text)'
                                  }}
                                >
                                  Sau
                                </button>
                              </div>
                            )}
                          </>
                        );
                      })()}
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
        if (projectId) {
          loadFolderFiles(projectId);
        }
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
      const url = 'campaigns?limit=1000';
      const res = await fetchAPI(url);
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
      const res = await fetchAPI('users?all=1');
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
    loadDevelopers();
    loadAllFiles();
    loadUsers();
    loadCampaigns();
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
  const fetchTeams = async () => {
    try {
      const res = await fetchAPI('teams');
      if (Array.isArray(res)) {
        setTeams(res);
      } else if (res && res.success && Array.isArray(res.data)) {
        setTeams(res.data);
      }
    } catch (e) {
      console.error('Failed to fetch teams:', e);
    }
  };

  const handleOpenRoster = async (projectId: number) => {
    setSelectedProjectId(projectId);
    setRosterSearch('');
    setIsRosterModalOpen(true);
    fetchTeams();
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
        if (editingProject && editingProject.id === selectedProjectId) {
          loadProjectRoster(editingProject.id);
        }
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
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.25rem'
      }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>
            {activeSubTab === 'campaigns' ? t('Quản Lý Chiến Dịch') : t('Quản Lý Dự Án')}
            <button
              onClick={() => setShowInfoModal(true)}
              style={{
                background: 'var(--color-bg-light)',
                border: '1px solid var(--color-border-light)',
                padding: '3px 10px',
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
                e.currentTarget.style.background = 'rgba(163, 20, 34, 0.04)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--color-text-muted)';
                e.currentTarget.style.borderColor = 'var(--color-border-light)';
                e.currentTarget.style.background = 'var(--color-bg-light)';
              }}
              title={t("Xem hướng dẫn thiết lập dự án, chiến dịch và roster")}
            >
              <Info size={12} style={{ marginTop: 1 }} />
              <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>{t("Giải thích cơ chế")}</span>
            </button>
          </h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0 0', fontSize: '0.825rem', color: 'var(--color-text-muted)' }}>
            {activeSubTab === 'campaigns' ? t('Cấu hình chiến dịch tiếp thị và quản lý roster nhận lead') : t('Đăng ký dự án, roster đội ngũ phân phối và quản lý tài liệu')}
          </p>
        </div>
        {(isAdmin || user?.role === 'manager' || (activeSubTab === 'campaigns' && projects.some(p => String(p.created_by) === String(user?.id) || (p.manager_ids && p.manager_ids.split(',').map(s=>s.trim()).includes(String(user?.id)))))) && (
          <div>
            {activeSubTab === 'projects' ? (
              (isAdmin || user?.role === 'manager') && (
                <button
                  onClick={() => {
                    setEditingProject({ status: 'active', campaign_sharing_mode: 'independent' });
                    setAutoCode(true);
                    setProjectModalMode('create');
                    setIsEditModalOpen(true);
                  }}
                  className="btn primary"
                  style={{ height: '36px', borderRadius: '8px', padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 700 }}
                >
                  <Plus size={16} />
                  Thêm dự án mới
                </button>
              )
            ) : (
              <button
                onClick={() => {
                  setEditingCampaign({ name: '', description: '', status: 'active', start_date: '', end_date: '', project_id: null, project_ids: '', user_ids: '', manager_ids: '', document_ids: '', folder_path: '' });
                  setCampaignModalMode('create');
                  setIsCampaignModalOpen(true);
                }}
                className="btn primary"
                style={{ height: '36px', borderRadius: '8px', padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 700 }}
              >
                <Plus size={16} />
                Thêm chiến dịch mới
              </button>
            )}
          </div>
        )}
      </div>

      {/* Control row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        background: '#ffffff',
        border: '1px solid var(--color-border-light)',
        borderRadius: '12px',
        padding: '0.625rem 1.25rem',
        marginBottom: '1.25rem',
        boxShadow: 'var(--shadow-sm)',
        width: '100%'
      }}>
        {/* Left: Tab selector (Underline style) */}
        <div style={{
          display: 'flex',
          gap: '1.5rem',
          alignItems: 'center',
          boxSizing: 'border-box'
        }}>
          {[
            { id: 'projects', label: 'Dự án', count: totalProjects, icon: <Building2 size={15} /> },
            { id: 'campaigns', label: 'Chiến dịch', count: totalCampaigns, icon: <Layers size={15} /> }
          ].map(tab => {
            const isSelected = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                style={{
                  height: '38px',
                  border: 'none',
                  borderBottom: isSelected ? '2px solid var(--color-primary)' : '2px solid transparent',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: 'transparent',
                  color: isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '0 4px',
                  outline: 'none',
                  boxShadow: 'none',
                  transition: 'all 0.2s ease',
                  marginTop: '2px'
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
                <span style={{
                  fontSize: '0.72rem',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: isSelected ? 'rgba(163, 20, 34, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                  color: isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  fontWeight: 800,
                  transition: 'background 0.2s ease, color 0.2s ease'
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Middle/Right: Filter & Stats consolidated */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {activeSubTab === 'campaigns' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              height: '38px'
            }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>Dự án:</span>
              <div style={{ width: '180px' }}>
                <CustomSelect
                  options={[
                    { value: '', label: 'Tất cả dự án' },
                    ...projects.map(p => ({ value: String(p.id), label: p.name }))
                  ]}
                  value={campaignProjectFilter}
                  onChange={val => {
                    setCampaignProjectFilter(String(val));
                    setCampaignPage(1);
                  }}
                  placeholder="Chọn dự án..."
                />
              </div>
            </div>
          )}

          <div style={{ 
            fontSize: '0.8rem', 
            color: 'var(--color-text-muted)', 
            fontWeight: 700,
            background: 'var(--color-bg-light)',
            padding: '0 12px',
            borderRadius: '8px',
            border: '1px solid var(--color-border-light)',
            height: '38px',
            display: 'flex',
            alignItems: 'center',
            boxSizing: 'border-box'
          }}>
            {activeSubTab === 'projects' 
              ? `Hiển thị ${projects.length} / ${totalProjects} dự án` 
              : `Hiển thị ${paginatedCampaigns.length} / ${filteredCampaigns.length} chiến dịch`
            }
          </div>
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
              setEditingProject({ status: 'active', campaign_sharing_mode: 'independent' });
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
                  className="card flex flex-col justify-between transition-all duration-300"
                  style={{
                    cursor: 'pointer',
                    background: '#ffffff',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '24px',
                    padding: '1.5rem',
                    boxShadow: '0 10px 30px -10px rgba(0,0,0,0.06)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                    e.currentTarget.style.boxShadow = '0 20px 40px -15px rgba(0,0,0,0.1)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.borderColor = 'var(--color-border-light)';
                    e.currentTarget.style.boxShadow = '0 10px 30px -10px rgba(0,0,0,0.06)';
                  }}
                  onClick={() => {
                    setEditingProject(proj);
                    setProjectModalMode('view');
                    setIsEditModalOpen(true);
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Header Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <div style={{
                          padding: '12px',
                          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(99, 102, 241, 0.1))',
                          borderRadius: '16px',
                          color: '#3b82f6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: 'inset 0 0 0 1px rgba(59, 130, 246, 0.15)'
                        }}>
                          <Building2 size={22} style={{ color: '#3b82f6' }} />
                        </div>
                        <div>
                          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, lineHeight: 1.35, letterSpacing: '-0.01em' }}>{proj.name}</h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '2px' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontFamily: 'monospace', fontWeight: 600 }}>
                              Mã: {proj.code}
                            </span>
                            {(() => {
                              const projManagers = parseIds(proj.manager_ids).map(id => users.find(u => Number(u.id) === Number(id))).filter(Boolean);
                              if (projManagers.length === 0) return null;
                              return (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-light)', fontWeight: 600 }}>QL:</span>
                                  <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                                    {projManagers.map((m: any, idx) => (
                                      <div 
                                        key={m.id} 
                                        style={{ 
                                          marginLeft: idx > 0 ? '-6px' : '0', 
                                          zIndex: 10 - idx,
                                          position: 'relative'
                                        }}
                                        title={`${m.full_name || m.username} (${m.role})`}
                                      >
                                        {m.avatar_url || m.avatar ? (
                                          <img 
                                            src={m.avatar_url || m.avatar} 
                                            alt={m.full_name} 
                                            style={{ 
                                              width: '20px', 
                                              height: '20px', 
                                              borderRadius: '50%', 
                                              border: '1.5px solid #ffffff', 
                                              objectFit: 'cover',
                                              boxShadow: '0 1px 3px rgba(0,0,0,0.1)' 
                                            }} 
                                          />
                                        ) : (
                                          <div style={{ 
                                            width: '20px', 
                                            height: '20px', 
                                            borderRadius: '50%', 
                                            border: '1.5px solid #ffffff', 
                                            background: '#f3f4f6', 
                                            color: '#4b5563', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center', 
                                            fontSize: '0.55rem', 
                                            fontWeight: 700,
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)' 
                                          }}>
                                            {(m.full_name || m.username || 'M').charAt(0).toUpperCase()}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '4px 10px',
                          borderRadius: '100px',
                          fontWeight: 700,
                          background: proj.status === 'active' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                          color: proj.status === 'active' ? '#10b981' : '#ef4444',
                          border: proj.status === 'active' ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid rgba(239, 68, 68, 0.15)',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}
                      >
                        {proj.status === 'active' ? 'Đang bán' : 'Tạm dừng'}
                      </span>
                    </div>

                    {/* Developer and Location with Icons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      {proj.developer && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: 'var(--color-text-light)', display: 'inline-flex' }}><Briefcase size={13} /></span>
                          <span>Chủ đầu tư: <strong style={{ color: 'var(--color-text)' }}>{proj.developer}</strong></span>
                        </div>
                      )}
                      {proj.location && (
                        <div style={{ display: 'flex', alignItems: 'start', gap: '6px' }}>
                          <span style={{ color: 'var(--color-text-light)', display: 'inline-flex', marginTop: '2px' }}><MapPin size={13} /></span>
                          <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>
                            {proj.location}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Construction Progress Bar */}
                    <div style={{ marginTop: '2px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.78rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--color-text-light)' }}>
                          Tiến độ: <span style={{ color: 'var(--color-text)' }}>{proj.construction_status || 'Chưa khởi công'}</span>
                        </span>
                        <span style={{ fontWeight: 800, color: (proj.progress_percent ?? 0) === 100 ? 'var(--color-success)' : 'var(--color-primary)' }}>{proj.progress_percent ?? 0}%</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'var(--color-border-light)', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{ width: `${proj.progress_percent ?? 0}%`, height: '100%', background: (proj.progress_percent ?? 0) === 100 ? 'var(--color-success)' : 'linear-gradient(90deg, #BD1D2D, #F97316)', borderRadius: '99px', transition: 'width 0.4s var(--transition-fluid)' }}></div>
                      </div>
                    </div>

                    {/* Project Details Grid (Pháp lý, Bàn giao) */}
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '1fr 1fr', 
                      gap: '8px', 
                      padding: '12px', 
                      background: 'var(--color-bg-light)', 
                      borderRadius: '16px', 
                      border: '1px solid var(--color-border-light)', 
                      fontSize: '0.78rem', 
                      color: 'var(--color-text-muted)' 
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-light)', fontWeight: 600 }}>Pháp lý</span>
                        <strong style={{ color: 'var(--color-text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={proj.legal_status || 'Đang hoàn thiện'}>
                          {proj.legal_status || 'Đang hoàn thiện'}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderLeft: '1px solid var(--color-border)', paddingLeft: '12px' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-light)', fontWeight: 600 }}>Bàn giao</span>
                        <strong style={{ color: 'var(--color-text)' }}>{proj.handover_year || 2028}</strong>
                      </div>
                    </div>

                    {/* Roster, Docs, Campaigns Info Badges */}
                    <div style={{ display: 'flex', gap: '6px', fontSize: '0.72rem', color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenRoster(proj.id);
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(100, 116, 139, 0.06)', border: '1px solid rgba(100, 116, 139, 0.12)', padding: '6px 10px', borderRadius: '100px', fontWeight: 700, color: '#64748b', cursor: 'pointer', transition: 'all 0.2s ease' }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(100, 116, 139, 0.12)';
                          e.currentTarget.style.transform = 'scale(1.03)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'rgba(100, 116, 139, 0.06)';
                          e.currentTarget.style.transform = 'none';
                        }}
                      >
                        <Users size={12} /> {proj.roster_count || 0} nhân sự
                      </span>
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDocs(proj.id);
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(100, 116, 139, 0.06)', border: '1px solid rgba(100, 116, 139, 0.12)', padding: '6px 10px', borderRadius: '100px', fontWeight: 700, color: '#64748b', cursor: 'pointer', transition: 'all 0.2s ease' }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(100, 116, 139, 0.12)';
                          e.currentTarget.style.transform = 'scale(1.03)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'rgba(100, 116, 139, 0.06)';
                          e.currentTarget.style.transform = 'none';
                        }}
                      >
                        <FileText size={12} /> {(proj.doc_count || 0) + parseIds(proj.document_ids).length} tài liệu
                      </span>
                      {(() => {
                        const linkedCamps = campaigns.filter(c => c.project_id === proj.id || (proj.campaign_ids && proj.campaign_ids.split(',').map((name: string) => name.trim()).includes(c.name)));
                        return (
                          <span 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenQuickCampaigns(proj, linkedCamps);
                            }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(100, 116, 139, 0.06)', border: '1px solid rgba(100, 116, 139, 0.12)', padding: '6px 10px', borderRadius: '100px', fontWeight: 700, color: '#64748b', cursor: 'pointer', transition: 'all 0.2s ease' }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = 'rgba(100, 116, 139, 0.12)';
                              e.currentTarget.style.transform = 'scale(1.03)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = 'rgba(100, 116, 139, 0.06)';
                              e.currentTarget.style.transform = 'none';
                            }}
                          >
                            <Layers size={12} /> {linkedCamps.length} chiến dịch
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex gap-2 pt-4" style={{ borderTop: '1px solid var(--color-border-light)', marginTop: '1.25rem' }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDocs(proj.id);
                      }}
                      className="btn secondary sm flex-1 flex justify-center items-center gap-1.5"
                      style={{
                        borderRadius: '12px',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        height: '36px',
                        background: 'var(--color-bg)',
                        border: '1px solid var(--color-border-light)',
                        color: 'var(--color-text)',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'var(--color-border-light)';
                        e.currentTarget.style.borderColor = 'var(--color-border)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'var(--color-bg)';
                        e.currentTarget.style.borderColor = 'var(--color-border-light)';
                      }}
                    >
                      <FileText size={14} />
                      Tài liệu
                    </button>
                    {isManagerOrLeader && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenRoster(proj.id);
                          }}
                          className="btn secondary sm"
                          style={{
                            borderRadius: '12px',
                            width: '36px',
                            height: '36px',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'var(--color-bg)',
                            border: '1px solid var(--color-border-light)',
                            color: 'var(--color-text)',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'var(--color-border-light)';
                            e.currentTarget.style.borderColor = 'var(--color-border)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'var(--color-bg)';
                            e.currentTarget.style.borderColor = 'var(--color-border-light)';
                          }}
                          title="Roster nhân viên"
                        >
                          <Users size={14} />
                        </button>
                        {canEditProject(proj) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingProject(proj);
                              setAutoCode(false);
                              setProjectModalMode('edit');
                              setIsEditModalOpen(true);
                            }}
                            className="btn secondary sm"
                            style={{
                              borderRadius: '12px',
                              width: '36px',
                              height: '36px',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'var(--color-bg)',
                              border: '1px solid var(--color-border-light)',
                              color: 'var(--color-text)',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = 'var(--color-border-light)';
                              e.currentTarget.style.borderColor = 'var(--color-border)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = 'var(--color-bg)';
                              e.currentTarget.style.borderColor = 'var(--color-border-light)';
                            }}
                            title="Sửa"
                          >
                            <Edit size={14} />
                          </button>
                        )}
                        {canDeleteProject(proj) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProject(proj.id);
                            }}
                            className="btn secondary sm"
                            style={{
                              borderRadius: '12px',
                              width: '36px',
                              height: '36px',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'var(--color-bg)',
                              border: '1px solid rgba(239, 68, 68, 0.15)',
                              color: '#ef4444',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.06)';
                              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = 'var(--color-bg)';
                              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.15)';
                            }}
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
        <>


          {campaignsLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth <= 768 ? 'repeat(auto-fill, minmax(280px, 1fr))' : 'repeat(3, 1fr)', gap: '1.5rem' }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <CampaignCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <EmptyCard
              icon={<Layers size={48} />}
              title="Chưa có chiến dịch nào"
              description="Bắt đầu tạo chiến dịch marketing để quản lý nguồn lead thu về."
            />
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth <= 768 ? 'repeat(auto-fill, minmax(280px, 1fr))' : 'repeat(3, 1fr)', gap: '1.5rem' }}>
                {paginatedCampaigns.map(camp => {
                  const associatedProj = camp.project_id 
                    ? projects.find(p => p.id === camp.project_id)
                    : projects.find(p => {
                        const campIds = p.campaign_ids ? p.campaign_ids.split(',').map((id: string) => id.trim()) : [];
                        return campIds.includes(camp.name);
                      });
                  const docCount = parseIds(camp.document_ids).length;
                  const staffCount = parseIds(camp.user_ids).length;

                  return (
                    <div 
                      key={camp.id} 
                      onClick={() => handleOpenCampaignView(camp)}
                      className="card flex flex-col justify-between transition-all duration-300"
                      style={{
                        cursor: 'pointer',
                        background: '#ffffff',
                        border: '1px solid var(--color-border-light)',
                        borderRadius: '24px',
                        padding: '1.5rem',
                        boxShadow: '0 10px 30px -10px rgba(0,0,0,0.06)',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                        e.currentTarget.style.boxShadow = '0 20px 40px -15px rgba(0,0,0,0.1)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.borderColor = 'var(--color-border-light)';
                        e.currentTarget.style.boxShadow = '0 10px 30px -10px rgba(0,0,0,0.06)';
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* Header Row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <div style={{
                              padding: '12px',
                              background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.1), rgba(225, 29, 72, 0.1))',
                              borderRadius: '16px',
                              color: 'var(--color-primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: 'inset 0 0 0 1px rgba(225, 29, 72, 0.15)'
                            }}>
                              <Layers size={22} style={{ color: 'var(--color-primary)' }} />
                            </div>
                            <div>
                              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, lineHeight: 1.35, letterSpacing: '-0.01em' }} className="line-clamp-1">{camp.name}</h3>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '2px' }}>
                                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontFamily: 'monospace', fontWeight: 600 }}>
                                  ID: {camp.id}
                                </span>
                                {(() => {
                                  const campManagers = parseIds(camp.manager_ids).map(id => users.find(u => Number(u.id) === Number(id))).filter(Boolean);
                                  if (campManagers.length === 0) return null;
                                  return (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-light)', fontWeight: 600 }}>QL:</span>
                                      <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                                        {campManagers.map((m: any, idx) => (
                                          <div 
                                            key={m.id} 
                                            style={{ 
                                              marginLeft: idx > 0 ? '-6px' : '0', 
                                              zIndex: 10 - idx,
                                              position: 'relative'
                                            }}
                                            title={`${m.full_name || m.username} (${m.role})`}
                                          >
                                            {m.avatar_url || m.avatar ? (
                                              <img 
                                                src={m.avatar_url || m.avatar} 
                                                alt={m.full_name} 
                                                style={{ 
                                                  width: '20px', 
                                                  height: '20px', 
                                                  borderRadius: '50%', 
                                                  border: '1.5px solid #ffffff', 
                                                  objectFit: 'cover',
                                                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)' 
                                                }} 
                                              />
                                            ) : (
                                              <div style={{ 
                                                width: '20px', 
                                                height: '20px', 
                                                borderRadius: '50%', 
                                                border: '1.5px solid #ffffff', 
                                                background: '#f3f4f6', 
                                                color: '#4b5563', 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center', 
                                                fontSize: '0.55rem', 
                                                fontWeight: 700,
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)' 
                                              }}>
                                                {(m.full_name || m.username || 'M').charAt(0).toUpperCase()}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                          <span 
                            style={{
                              fontSize: '0.72rem',
                              padding: '4px 10px',
                              borderRadius: '100px',
                              fontWeight: 700,
                              background: camp.status === 'active' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                              color: camp.status === 'active' ? '#10b981' : '#ef4444',
                              border: camp.status === 'active' ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid rgba(239, 68, 68, 0.15)',
                              whiteSpace: 'nowrap',
                              flexShrink: 0
                            }}
                          >
                            {camp.status === 'active' ? 'Hoạt động' : 'Tạm dừng'}
                          </span>
                        </div>

                        {/* Description */}
                        {camp.description ? (
                          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }} className="line-clamp-2">
                            {camp.description}
                          </p>
                        ) : (
                          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', fontStyle: 'italic', margin: 0 }}>
                            Không có mô tả chi tiết
                          </p>
                        )}

                        {/* Rich Campaign Info List (Dates, Folder, Reference links) */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: 'var(--color-text-muted)', borderTop: '1px dotted var(--color-border-light)', paddingTop: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: 'var(--color-text-light)', display: 'inline-flex' }}><Building2 size={13} /></span>
                            <span>Dự án liên kết: <strong style={{ color: 'var(--color-primary)' }}>{associatedProj ? associatedProj.name : 'Chưa liên kết'}</strong></span>
                          </div>

                          {(camp.start_date || camp.end_date) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ color: 'var(--color-text-light)', display: 'inline-flex' }}><Calendar size={13} /></span>
                              <span>Thời gian: <strong>{camp.start_date || '...'}</strong> đến <strong>{camp.end_date || '...'}</strong></span>
                            </div>
                          )}

                          {camp.folder_path && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                              <span style={{ color: 'var(--color-text-light)', display: 'inline-flex' }}><Folder size={13} /></span>
                              <span>Thư mục:</span>
                              {renderFolderPathLink(camp.folder_path, camp.project_id)}
                            </div>
                          )}

                          {camp.reference_url && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={e => e.stopPropagation()}>
                              <span style={{ color: 'var(--color-text-light)', display: 'inline-flex' }}><Link2 size={13} /></span>
                              <span>Liên kết khác:</span>
                              <a 
                                href={camp.reference_url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                Mở liên kết <ExternalLink size={11} />
                              </a>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Footer Stats Bar */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border-light)', paddingTop: '0.75rem', marginTop: '1rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--color-bg-light)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--color-border-light)', fontWeight: 600 }}>
                            <Folder size={12} style={{ color: 'var(--color-text-light)' }} />
                            {docCount} Tài liệu
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--color-bg-light)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--color-border-light)', fontWeight: 600 }}>
                            <Users size={12} style={{ color: 'var(--color-text-light)' }} />
                            {staffCount} Roster
                          </span>
                        </div>
                        {(isManagerOrLeader || canEditCampaign(camp)) && (
                          <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                            {canEditCampaign(camp) && (
                              <button
                                onClick={() => {
                                  setEditingCampaign(camp);
                                  setCampaignModalMode('edit');
                                  setIsCampaignModalOpen(true);
                                }}
                                className="btn outline icon-only sm"
                                style={{ width: '28px', height: '28px', borderRadius: '8px', padding: 0 }}
                                title="Sửa"
                              >
                                <Edit size={12} />
                              </button>
                            )}
                            {canDeleteCampaign(camp) && (
                              <button
                                onClick={() => handleDeleteCampaign(camp.id)}
                                className="btn outline icon-only sm"
                                style={{ width: '28px', height: '28px', borderRadius: '8px', padding: 0, color: 'var(--color-danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                                title="Xóa"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center', paddingBottom: '2.5rem' }}>
              <Pagination
                total={filteredCampaigns.length}
                page={campaignPage}
                pageSize={campaignPageSize}
                onChange={setCampaignPage}
                showSizeChanger={true}
                onPageSizeChange={setCampaignPageSize}
              />
            </div>
          </>
        )}
        </>
      )}
      </div>

      {/* Edit Modal (converted to Drawer) */}
      {renderDrawer(
        isEditModalOpen,
        () => {
          setIsEditModalOpen(false);
          setEditingProject(null);
        },
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
              {editingProject && renderEntityComments('project', editingProject.id)}

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
                            padding: '12px 16px',
                            borderRadius: '12px',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.01)'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                            e.currentTarget.style.background = '#ffffff';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 6px 16px rgba(163, 20, 34, 0.06)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'var(--color-border-light)';
                            e.currentTarget.style.background = 'var(--color-bg-light)';
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.01)';
                          }}
                          onClick={() => handleOpenTask(task.id)}
                          title={t('Click để xem chi tiết nhiệm vụ')}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <div style={{ marginTop: '3px' }}>
                              <CheckSquare size={18} color={task.status === 'done' ? 'var(--color-success)' : 'var(--color-text-muted)'} style={{ opacity: 0.85 }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span style={{ fontWeight: 650, color: 'var(--color-text)', fontSize: '0.9rem', lineHeight: '1.2' }}>{task.subject}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Avatar 
                                  src={performer?.avatar_url || performer?.avatar} 
                                  name={performer?.full_name || performer?.name || 'Hệ thống'} 
                                  size={18} 
                                />
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                                  {performer?.full_name || 'Hệ thống'} {performer?.role ? `(${performer.role})` : ''}
                                </span>
                              </div>
                            </div>
                          </div>
                          <span style={{ 
                            fontSize: '0.72rem', 
                            fontWeight: 700, 
                            padding: '4px 10px', 
                            borderRadius: '100px', 
                            background: sc.bg, 
                            color: sc.text,
                            textTransform: 'uppercase',
                            letterSpacing: '0.03em'
                          }}>
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
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      padding: '0 12px', 
                      background: 'var(--color-bg-light)', 
                      borderRadius: 'var(--radius-md)', 
                      border: '1px solid var(--color-border-light)', 
                      height: '42px' 
                    }}>
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

                  <div style={{ gridColumn: 'span 2', borderTop: '1px solid var(--color-border-light)', paddingTop: '16px', marginTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label className="form-label" style={{ marginBottom: 0 }}>Website &amp; Tài liệu tham khảo liên kết</label>
                      <button
                        type="button"
                        onClick={() => {
                          const currentLinks = parseReferenceLinks(editingProject?.reference_url);
                          const nextLinks = [...currentLinks, { title: 'Tài liệu tham khảo', url: '' }];
                          setEditingProject(prev => ({ ...prev, reference_url: JSON.stringify(nextLinks) }));
                        }}
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
                        <Plus size={12} />
                        <span>Thêm Link mới</span>
                      </button>
                    </div>

                    {(() => {
                      const currentLinks = parseReferenceLinks(editingProject?.reference_url);
                      if (currentLinks.length === 0) {
                        return (
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '8px 12px', background: 'var(--color-bg-light)', border: '1px dashed var(--color-border)', borderRadius: '10px' }}>
                            Chưa có đường dẫn tham khảo nào. Bấm "Thêm Link mới" để cấu hình.
                          </div>
                        );
                      }
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {currentLinks.map((link, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <input
                                type="text"
                                value={link.title}
                                onChange={e => {
                                  const updated = [...currentLinks];
                                  updated[idx].title = e.target.value;
                                  setEditingProject(prev => ({ ...prev, reference_url: JSON.stringify(updated) }));
                                }}
                                className="form-input"
                                placeholder="Tên liên kết (Ví dụ: GG Sheets Phí)"
                                style={{ flex: 1 }}
                              />
                              <input
                                type="text"
                                value={link.url}
                                onChange={e => {
                                  const updated = [...currentLinks];
                                  updated[idx].url = e.target.value;
                                  setEditingProject(prev => ({ ...prev, reference_url: JSON.stringify(updated) }));
                                }}
                                className="form-input"
                                placeholder="https://..."
                                style={{ flex: 2 }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = currentLinks.filter((_, i) => i !== idx);
                                  setEditingProject(prev => ({ ...prev, reference_url: JSON.stringify(updated) }));
                                }}
                                className="btn secondary sm"
                                style={{ color: 'var(--color-danger)', borderColor: 'rgba(239, 68, 68, 0.2)', width: '38px', height: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
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

                <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      Đội ngũ nhân sự phụ trách (Roster)
                    </span>
                     {editingProject?.id && (
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => handleOpenRoster(editingProject.id)}
                        style={{ fontSize: '0.75rem', color: 'var(--color-primary)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 700 }}
                      >
                        {canEditRoster ? 'Cấu hình Roster' : 'Xem Roster'}
                      </button>
                    )}
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    background: 'var(--color-bg-light, #f8fafc)', 
                    padding: '8px 12px', 
                    borderRadius: '12px', 
                    border: '1px solid var(--color-border-light)'
                  }}>
                    {projectRoster.length > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {projectRoster
                          .slice(0, 5)
                          .map((m: any) => (
                            <Avatar key={m.id} src={m.avatar_url} name={m.full_name} size={22} />
                          ))
                        }
                        {projectRoster.length > 5 && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                            +{projectRoster.length - 5}
                          </span>
                        )}
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text)', marginLeft: '4px' }}>
                          ({projectRoster.length} nhân sự)
                        </span>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        Chưa phân công nhân sự phân phối
                      </span>
                    )}
                  </div>
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
                  <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label className="form-label" style={{ marginBottom: 0 }}>Đường dẫn Folder liên kết</label>
                      <button
                        type="button"
                        onClick={() => {
                          const currentFolders = parseFolderPaths(editingProject?.folder_path);
                          const nextFolders = [...currentFolders, { type: 'link' as const, path: '' }];
                          setEditingProject(prev => ({ ...prev, folder_path: JSON.stringify(nextFolders) }));
                        }}
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
                        <Plus size={12} />
                        <span>Thêm Thư mục</span>
                      </button>
                    </div>

                    {(() => {
                      const currentFolders = parseFolderPaths(editingProject?.folder_path);
                      if (currentFolders.length === 0) {
                        return (
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '8px 12px', background: 'var(--color-bg-light)', border: '1px dashed var(--color-border)', borderRadius: '10px' }}>
                            Chưa liên kết thư mục nào. Bấm "Thêm Thư mục" để cấu hình.
                          </div>
                        );
                      }
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {currentFolders.map((f, idx) => (
                            <div key={idx} style={{ background: 'var(--color-bg-light)', padding: '12px', borderRadius: '12px', border: '1px solid var(--color-border-light)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', background: '#ffffff', padding: '2px', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...currentFolders];
                                      updated[idx].type = 'link';
                                      setEditingProject(prev => ({ ...prev, folder_path: JSON.stringify(updated) }));
                                    }}
                                    style={{
                                      padding: '4px 8px',
                                      borderRadius: '6px',
                                      border: 'none',
                                      background: f.type === 'link' ? 'var(--color-primary)' : 'transparent',
                                      color: f.type === 'link' ? 'white' : 'var(--color-text-muted)',
                                      fontSize: '0.7rem',
                                      fontWeight: 700,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Dán Link (Drive)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...currentFolders];
                                      updated[idx].type = 'select';
                                      setEditingProject(prev => ({ ...prev, folder_path: JSON.stringify(updated) }));
                                    }}
                                    style={{
                                      padding: '4px 8px',
                                      borderRadius: '6px',
                                      border: 'none',
                                      background: f.type === 'select' ? 'var(--color-primary)' : 'transparent',
                                      color: f.type === 'select' ? 'white' : 'var(--color-text-muted)',
                                      fontSize: '0.7rem',
                                      fontWeight: 700,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Chọn thư mục
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = currentFolders.filter((_, i) => i !== idx);
                                    setEditingProject(prev => ({ ...prev, folder_path: JSON.stringify(updated) }));
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--color-danger)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '4px'
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                              {f.type === 'link' ? (
                                <input
                                  type="text"
                                  value={f.path}
                                  onChange={e => {
                                    const updated = [...currentFolders];
                                    updated[idx].path = e.target.value;
                                    setEditingProject(prev => ({ ...prev, folder_path: JSON.stringify(updated) }));
                                  }}
                                  className="form-input"
                                  placeholder="Dán link thư mục Google Drive..."
                                />
                              ) : (
                                <CustomSelect
                                  options={fileCategories.map(cat => ({ value: cat.label, label: cat.label }))}
                                  value={f.path}
                                  onChange={val => {
                                    const updated = [...currentFolders];
                                    updated[idx].path = String(val);
                                    setEditingProject(prev => ({ ...prev, folder_path: JSON.stringify(updated) }));
                                  }}
                                  placeholder="Chọn thư mục từ /files..."
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
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
                    <label className="form-label" style={{ fontWeight: 600 }}>Chiến dịch liên kết</label>
                    <CustomSelect
                      multiple
                      searchable={true}
                      options={campaigns.map(c => ({ value: String(c.id), label: c.name, faded: c.status !== 'active' }))}
                      value={
                        editingProject?.campaign_ids_array !== undefined
                          ? editingProject.campaign_ids_array.map(String)
                          : campaigns.filter(c => c.project_id === editingProject?.id).map(c => String(c.id))
                      }
                      onChange={val => {
                        const selectedIds = Array.isArray(val) ? val.map(Number) : [];
                        const selectedNames = campaigns.filter(c => selectedIds.includes(c.id)).map(c => c.name);
                        setEditingProject(prev => ({
                          ...prev,
                          campaign_ids: selectedNames.join(','),
                          campaign_ids_array: selectedIds
                        }));
                      }}
                      placeholder="Chọn chiến dịch..."
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 600 }}>Cấu hình chia sẻ chiến dịch</label>
                    <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : 'repeat(3, 1fr)', gap: '8px', marginTop: '6px' }}>
                      {/* Option 1: Công khai */}
                      <div
                        onClick={() => setEditingProject(prev => prev ? ({ ...prev, campaign_sharing_mode: 'public' }) : prev)}
                        style={{
                          border: `1px solid ${editingProject?.campaign_sharing_mode === 'public' ? 'var(--color-primary)' : 'var(--color-border-light)'}`,
                          background: editingProject?.campaign_sharing_mode === 'public' ? 'rgba(189, 29, 45, 0.04)' : '#ffffff',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.8rem', color: editingProject?.campaign_sharing_mode === 'public' ? 'var(--color-primary)' : 'var(--color-text)' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: editingProject?.campaign_sharing_mode === 'public' ? 'var(--color-primary)' : '#cbd5e1' }}></span>
                          Công khai
                        </div>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', lineHeight: '1.2' }}>
                          Mọi nhân sự trong hệ thống đều thấy chiến dịch con.
                        </span>
                      </div>

                      {/* Option 2: Nhân sự dự án */}
                      <div
                        onClick={() => setEditingProject(prev => prev ? ({ ...prev, campaign_sharing_mode: 'project_members' }) : prev)}
                        style={{
                          border: `1px solid ${editingProject?.campaign_sharing_mode === 'project_members' ? 'var(--color-primary)' : 'var(--color-border-light)'}`,
                          background: editingProject?.campaign_sharing_mode === 'project_members' ? 'rgba(189, 29, 45, 0.04)' : '#ffffff',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.8rem', color: editingProject?.campaign_sharing_mode === 'project_members' ? 'var(--color-primary)' : 'var(--color-text)' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: editingProject?.campaign_sharing_mode === 'project_members' ? 'var(--color-primary)' : '#cbd5e1' }}></span>
                          Nhân sự dự án
                        </div>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', lineHeight: '1.2' }}>
                          Chỉ nhân sự thuộc roster dự án thấy chiến dịch con.
                        </span>
                      </div>

                      {/* Option 3: Chiến dịch độc lập */}
                      <div
                        onClick={() => setEditingProject(prev => prev ? ({ ...prev, campaign_sharing_mode: 'independent' }) : prev)}
                        style={{
                          border: `1px solid ${(!editingProject?.campaign_sharing_mode || editingProject?.campaign_sharing_mode === 'independent') ? 'var(--color-primary)' : 'var(--color-border-light)'}`,
                          background: (!editingProject?.campaign_sharing_mode || editingProject?.campaign_sharing_mode === 'independent') ? 'rgba(189, 29, 45, 0.04)' : '#ffffff',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.8rem', color: (!editingProject?.campaign_sharing_mode || editingProject?.campaign_sharing_mode === 'independent') ? 'var(--color-primary)' : 'var(--color-text)' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: (!editingProject?.campaign_sharing_mode || editingProject?.campaign_sharing_mode === 'independent') ? 'var(--color-primary)' : '#cbd5e1' }}></span>
                          Độc lập (Mặc định)
                        </div>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', lineHeight: '1.2' }}>
                          Chỉ thành viên của riêng chiến dịch đó mới thấy.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </form>
        )}
      </>,
      '960px',
      projectModalMode === 'view' ? (
        <button
          onClick={() => setProjectDrawerTab(projectDrawerTab === 'details' ? 'changelog' : 'details')}
          style={{
            border: 'none',
            background: projectDrawerTab === 'changelog' ? 'rgba(163, 20, 34, 0.08)' : 'transparent',
            cursor: 'pointer',
            color: projectDrawerTab === 'changelog' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px',
            borderRadius: '8px',
            transition: 'all 0.2s ease',
            outline: 'none'
          }}
          title={projectDrawerTab === 'details' ? 'Xem lịch sử thay đổi' : 'Xem thông tin chi tiết'}
          className="hover-lift"
        >
          <History size={20} />
        </button>
      ) : (
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

              {/* Add Team Dropdown / Buttons */}
              {canEditRoster && teams.length > 0 && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  background: 'rgba(0, 0, 0, 0.015)', 
                  padding: '10px 16px', 
                  borderRadius: '12px', 
                  border: '1px solid var(--color-border-light)'
                }}>
                  <div style={{ flexShrink: 0 }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      Thêm nhanh theo Nhóm (Team):
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ width: '280px' }}>
                      <CustomSelect
                        multiple={true}
                        searchable={true}
                        placeholder="Chọn Nhóm (Team)..."
                        options={teams
                          .map(team => {
                            const teamMembers = rosterMembers.filter(m => Number(m.team_id) === Number(team.id) || Number(m.id) === Number(team.leader_id));
                            const assignedInTeam = teamMembers.filter(m => m.is_assigned === 1);
                            if (teamMembers.length === 0) return null;
                            return {
                              value: String(team.id),
                              label: team.name,
                              sublabel: `${assignedInTeam.length}/${teamMembers.length} thành viên`
                            };
                          })
                          .filter(Boolean) as any[]
                        }
                        value={teams
                          .filter(team => {
                            const teamMembers = rosterMembers.filter(m => Number(m.team_id) === Number(team.id) || Number(m.id) === Number(team.leader_id));
                            return teamMembers.length > 0 && teamMembers.every(m => m.is_assigned === 1);
                          })
                          .map(team => String(team.id))
                        }
                        onChange={(newVal: string[]) => {
                          const currentSelected = teams
                            .filter(team => {
                              const teamMembers = rosterMembers.filter(m => Number(m.team_id) === Number(team.id) || Number(m.id) === Number(team.leader_id));
                              return teamMembers.length > 0 && teamMembers.every(m => m.is_assigned === 1);
                            })
                            .map(team => String(team.id));

                          const addedIds = newVal.filter(id => !currentSelected.includes(id)).map(Number);
                          const removedIds = currentSelected.filter(id => !newVal.includes(id)).map(Number);

                          const addedLeaders = teams.filter(t => addedIds.includes(t.id)).map(t => Number(t.leader_id));
                          const removedLeaders = teams.filter(t => removedIds.includes(t.id)).map(t => Number(t.leader_id));

                          setRosterMembers(prev =>
                            prev.map(m => {
                              if (addedIds.includes(Number(m.team_id)) || addedLeaders.includes(Number(m.id))) {
                                return { ...m, is_assigned: 1 };
                              }
                              if (removedIds.includes(Number(m.team_id)) || removedLeaders.includes(Number(m.id))) {
                                return { ...m, is_assigned: 0 };
                              }
                              return m;
                            })
                          );
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      className="btn sm outline"
                      onClick={() => {
                        setRosterMembers(prev => prev.map(m => ({ ...m, is_assigned: 0 })));
                      }}
                      style={{ 
                        borderRadius: '8px', 
                        padding: '6px 12px', 
                        fontSize: '0.75rem', 
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        height: '38px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      Bỏ chọn tất cả
                    </button>
                  </div>
                </div>
              )}

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(3, 1fr)', 
                gap: '0.75rem', 
                overflowY: 'auto', 
                paddingRight: '4px',
                maxHeight: '450px'
              }}>
                {sorted.length === 0 ? (
                  <div style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '2rem 0', fontSize: '0.875rem' }}>
                    Không tìm thấy nhân sự phù hợp
                  </div>
                ) : (
                  sorted.map(member => {
                    return (
                      <div
                        key={member.id}
                        onClick={() => canEditRoster && handleToggleRoster(member.id)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.75rem 1rem',
                          borderRadius: 'var(--radius-lg)',
                          border: member.is_assigned ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                          background: member.is_assigned ? 'var(--color-primary-light)' : 'var(--color-surface)',
                          cursor: canEditRoster ? 'pointer' : 'default',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <Avatar src={member.avatar_url} name={member.full_name} size={36} />
                          <div>
                            <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>
                              {member.full_name}
                              <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-muted)', marginLeft: '4px' }}>
                                ({member.role === 'sales' || member.role === 'sale' ? 'Sale' : member.role === 'manager' ? 'Manager' : member.role === 'director' ? 'Director' : member.role})
                              </span>
                            </h4>
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
            {canEditRoster ? (
              <>
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
              </>
            ) : (
              <button 
                type="button" 
                className="btn secondary sm" 
                style={{ borderRadius: '100px', fontWeight: 700 }} 
                onClick={() => setIsRosterModalOpen(false)}
              >
                Đóng
              </button>
            )}
          </div>
        )
      )}

      {renderQuickCampaignsDrawer()}

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
              {selectedProj?.folder_path && parseFolderPaths(selectedProj.folder_path).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {parseFolderPaths(selectedProj.folder_path).map((f, idx) => (
                    <div 
                      key={idx}
                      onClick={() => {
                        console.log('Clicked folder card:', f.path, 'selectedProjectId:', selectedProjectId);
                        if (f.type !== 'link' && selectedProjectId) {
                          handleOpenFolderModal(f.path, selectedProjectId);
                        }
                      }}
                      style={{
                        padding: '0.85rem 1rem',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-lg)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: f.type === 'link' ? 'rgba(59, 130, 246, 0.04)' : 'rgba(16, 185, 129, 0.04)',
                        borderColor: f.type === 'link' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        cursor: f.type === 'link' ? 'default' : 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={e => {
                        if (f.type !== 'link') {
                          e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                          e.currentTarget.style.background = 'rgba(16, 185, 129, 0.08)';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (f.type !== 'link') {
                          e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.15)';
                          e.currentTarget.style.background = 'rgba(16, 185, 129, 0.04)';
                          e.currentTarget.style.transform = 'none';
                        }
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, marginRight: '1rem' }}>
                        <h4 style={{ margin: 0, fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {f.type === 'link' ? <HardDrive size={15} color="#3b82f6" /> : <Folder size={15} color="#10b981" />}
                          {f.type === 'link' ? 'Google Drive liên kết' : 'Thư mục tài liệu'}
                        </h4>
                        <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.path}
                        </p>
                      </div>
                      {f.type === 'link' ? (
                        <a
                          href={f.path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn success sm"
                          style={{ borderRadius: '10px', fontSize: '0.75rem', height: '32px', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', textDecoration: 'none', background: '#3b82f6', color: '#fff', border: 'none' }}
                          onClick={e => e.stopPropagation()}
                        >
                          <ExternalLink size={12} />
                          Mở Link
                        </a>
                      ) : (
                        <button
                          type="button"
                          className="btn success sm"
                          style={{ borderRadius: '10px', fontSize: '0.75rem', height: '32px', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer' }}
                          onClick={e => {
                            e.stopPropagation();
                            console.log('Clicked folder button: icon=folder, path=', f.path, 'selectedProjectId:', selectedProjectId);
                            if (selectedProjectId) {
                              handleOpenFolderModal(f.path, selectedProjectId);
                            }
                          }}
                        >
                          <Folder size={12} />
                          Kho tài liệu
                        </button>
                      )}
                    </div>
                  ))}
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
        () => {
          setIsCampaignModalOpen(false);
          setEditingCampaign(null);
        },
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
                      {renderFolderPathLink(editingCampaign?.folder_path, editingCampaign?.project_id)}
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
              {editingCampaign && renderEntityComments('campaign', editingCampaign.id)}

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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#f3f4f6', border: '1px solid var(--color-border-light)', borderRadius: '12px', color: '#6b7280', fontSize: '0.8rem', fontWeight: 550, cursor: 'not-allowed' }}>
                        <Info size={12} style={{ opacity: 0.6 }} />
                        <span>Chưa liên kết dự án nào</span>
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

                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '8px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                              <span>Thư mục:</span> 
                              {parseFolderPaths(proj.folder_path).map((f, idx) => (
                                <span key={idx}>{renderFolderPathLink(f.path, proj.id)}</span>
                              ))}
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
                            padding: '12px 16px',
                            borderRadius: '12px',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.01)'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                            e.currentTarget.style.background = '#ffffff';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 6px 16px rgba(163, 20, 34, 0.06)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'var(--color-border-light)';
                            e.currentTarget.style.background = 'var(--color-bg-light)';
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.01)';
                          }}
                          onClick={() => handleOpenTask(task.id)}
                          title={t('Click để xem chi tiết nhiệm vụ')}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <div style={{ marginTop: '3px' }}>
                              <CheckSquare size={18} color={task.status === 'done' ? 'var(--color-success)' : 'var(--color-text-muted)'} style={{ opacity: 0.85 }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span style={{ fontWeight: 650, color: 'var(--color-text)', fontSize: '0.9rem', lineHeight: '1.2' }}>{task.subject}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Avatar 
                                  src={performer?.avatar_url || performer?.avatar} 
                                  name={performer?.full_name || performer?.name || 'Hệ thống'} 
                                  size={18} 
                                />
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                                  {performer?.full_name || 'Hệ thống'} {performer?.role ? `(${performer.role})` : ''}
                                </span>
                              </div>
                            </div>
                          </div>
                          <span style={{ 
                            fontSize: '0.72rem', 
                            fontWeight: 700, 
                            padding: '4px 10px', 
                            borderRadius: '100px', 
                            background: sc.bg, 
                            color: sc.text,
                            textTransform: 'uppercase',
                            letterSpacing: '0.03em'
                          }}>
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
                    <label className="form-label" style={{ fontWeight: 600 }}>Dự án liên kết</label>
                    <CustomSelect
                      searchable={true}
                      options={projects.map(p => ({ value: String(p.id), label: `${p.name} (${p.code})` }))}
                      value={editingCampaign?.project_id ? String(editingCampaign.project_id) : ''}
                      onChange={val => setEditingCampaign({ 
                        ...editingCampaign, 
                        project_id: val ? Number(val) : null,
                        project_ids: val ? (projects.find(p => String(p.id) === String(val))?.name || '') : ''
                      })}
                      placeholder="Chọn dự án..."
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
      campaignModalMode === 'view' ? (
        <button
          onClick={() => setCampaignDrawerTab(campaignDrawerTab === 'details' ? 'changelog' : 'details')}
          style={{
            border: 'none',
            background: campaignDrawerTab === 'changelog' ? 'rgba(100, 116, 139, 0.08)' : 'transparent',
            cursor: 'pointer',
            color: campaignDrawerTab === 'changelog' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px',
            borderRadius: '8px',
            transition: 'all 0.2s ease',
            outline: 'none'
          }}
          title={campaignDrawerTab === 'details' ? 'Xem lịch sử thay đổi' : 'Xem thông tin chi tiết'}
          className="hover-lift"
        >
          <History size={20} />
        </button>
      ) : (
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

      {/* Roster List Modal */}
      <CustomModal
        isOpen={showRosterModal}
        onClose={() => setShowRosterModal(false)}
        title={`Đội ngũ nhân sự phụ trách - ${editingProject?.name}`}
        width="540px"
      >
        <div style={{ padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>
            Danh sách nhân sự thuộc roster phân phối của dự án này ({projectRoster.length} người):
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
            {projectRoster.map((member: any) => (
              <div 
                key={member.id} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '10px 14px', 
                  background: 'var(--color-bg-light)', 
                  border: '1px solid var(--color-border-light)', 
                  borderRadius: '12px' 
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Avatar src={member.avatar_url || member.avatar} name={member.full_name || member.name} size={36} />
                  <div>
                    <span style={{ fontWeight: 700, color: 'var(--color-text)', display: 'block', fontSize: '0.9rem' }}>
                      {member.full_name || member.name}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {member.email}
                    </span>
                  </div>
                </div>
                <span 
                  className={`badge ${member.role === 'manager' ? 'primary' : 'secondary'}`}
                  style={{ fontSize: '0.7rem', padding: '4px 8px', borderRadius: '100px', fontWeight: 700, textTransform: 'uppercase' }}
                >
                  {member.role || 'sales'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CustomModal>

      {/* Folder Contents Modal */}
      <CustomModal
        isOpen={showFolderModal}
        onClose={() => setShowFolderModal(false)}
        title={`Thư mục: ${folderModalPath}`}
        width="800px"
      >
        <div style={{ padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>
              Danh sách tài liệu thuộc thư mục dự án này ({folderFiles.length} tệp tin):
            </span>
            {folderModalProjectId && (
              <div>
                <input 
                  type="file" 
                  id="folder-modal-upload" 
                  style={{ display: 'none' }} 
                  onChange={(e) => folderModalProjectId && handleQuickUpload(e, folderModalProjectId)} 
                />
                <button
                  type="button"
                  onClick={() => document.getElementById('folder-modal-upload')?.click()}
                  className="btn primary sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, borderRadius: '8px', padding: '6px 12px' }}
                >
                  <Upload size={14} />
                  Tải tệp lên
                </button>
              </div>
            )}
          </div>

          {folderFilesLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0' }}>
              <RefreshCw className="spin" size={24} color="var(--color-text-muted)" />
            </div>
          ) : folderFiles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--color-text-muted)', border: '1px dashed var(--color-border-light)', borderRadius: '12px', background: 'var(--color-bg-light)' }}>
              <Folder size={32} style={{ color: 'var(--color-text-light)', marginBottom: '8px' }} />
              <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>Thư mục trống</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--color-text-light)' }}>Chưa có tài liệu nào được tải lên cho dự án này.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
              {folderFiles.map((fileObj: any) => (
                <div 
                  key={fileObj.id} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '10px 14px', 
                    background: 'var(--color-bg-light)', 
                    border: '1px solid var(--color-border-light)', 
                    borderRadius: '12px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                    <FileText size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                    <span style={{ fontWeight: 650, color: 'var(--color-text)', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={fileObj.name}>
                      {fileObj.name}
                    </span>
                  </div>
                  <a
                    href={`${import.meta.env.VITE_API_URL ?? '/backend'}/${fileObj.file_path}`}
                    download={fileObj.name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn outline sm"
                    style={{ fontSize: '0.75rem', height: '28px', padding: '0 10px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, borderRadius: '6px' }}
                  >
                    <Download size={12} />
                    Tải về
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </CustomModal>

      <WorkspaceTaskDrawer
        isOpen={!!selectedTaskForDrawer}
        onClose={() => {
          setSelectedTaskForDrawer(null);
          const params = new URLSearchParams(window.location.search);
          params.delete('task_id');
          navigate(`${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`, { replace: true });
        }}
        task={selectedTaskForDrawer}
        onUpdate={() => {
          window.dispatchEvent(new CustomEvent('task-updated'));
        }}
        users={users}
      />
    </div>
  );
}
