import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { fetchAPI } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
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
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [developers, setDevelopers] = useState<any[]>([]);
  const [allFiles, setAllFiles] = useState<any[]>([]);
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

  const isAdmin = (user?.role as string) === 'admin' || (user?.role as string) === 'superadmin' || (user?.role as string) === 'manager';

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
        setError(res.message || 'Lỗi tải danh sách dự án');
      }
    } catch (e: any) {
      setError(e.message || 'Lỗi kết nối');
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
      setError('Tên chiến dịch là bắt buộc');
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
        setSuccess(isNew ? 'Tạo chiến dịch thành công!' : 'Cập nhật chiến dịch thành công!');
        setIsCampaignModalOpen(false);
        loadCampaigns();
      } else {
        setError(res.message || 'Lỗi lưu thông tin chiến dịch');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối');
    }
  };

  const handleDeleteCampaign = async (id: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa chiến dịch này?')) return;

    try {
      const res = await fetchAPI(`campaigns/${id}`, { method: 'DELETE' });
      if (res.success) {
        setSuccess('Xóa chiến dịch thành công!');
        loadCampaigns();
      } else {
        setError(res.message || 'Lỗi khi xóa chiến dịch');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối');
    }
  };

  useEffect(() => {
    loadProjects();
    loadDevelopers();
    loadAllFiles();
    loadCampaigns();
  }, []);

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject?.name) {
      setError('Tên dự án là bắt buộc');
      return;
    }
    if (!autoCode && !editingProject?.code) {
      setError('Mã dự án là bắt buộc khi tắt tự động sinh mã');
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
        setSuccess(isNew ? 'Tạo dự án thành công!' : 'Cập nhật dự án thành công!');
        setIsEditModalOpen(false);
        loadProjects();
      } else {
        setError(res.message || 'Lỗi lưu thông tin');
      }
    } catch (e: any) {
      setError(e.message || 'Lỗi kết nối');
    }
  };

  const handleDeleteProject = async (id: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa dự án này?')) return;

    try {
      const res = await fetchAPI(`projects/${id}`, { method: 'DELETE' });
      if (res.success) {
        setSuccess('Xóa dự án thành công!');
        loadProjects();
      } else {
        setError(res.message || 'Lỗi xóa dự án');
      }
    } catch (e: any) {
      setError(e.message || 'Lỗi kết nối');
    }
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
        setError(res.message || 'Lỗi tải roster');
      }
    } catch (e: any) {
      setError(e.message || 'Lỗi kết nối');
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
        setSuccess('Cập nhật roster dự án thành công!');
        setIsRosterModalOpen(false);
      } else {
        setError(res.message || 'Lỗi lưu roster');
      }
    } catch (e: any) {
      setError(e.message || 'Lỗi kết nối');
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
        setError(res.message || 'Lỗi tải tài liệu');
      }
    } catch (e: any) {
      setError(e.message || 'Lỗi kết nối');
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
        setSuccess('Tải tài liệu lên thành công!');
        loadDocuments(selectedProjectId);
      } else {
        setError(res.message || 'Lỗi tải tài liệu lên');
      }
    } catch (e: any) {
      setError(e.message || 'Lỗi tải file');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDoc = async (docId: number) => {
    if (!selectedProjectId || !window.confirm('Bạn có chắc chắn muốn xóa tài liệu này?')) return;

    try {
      const res = await fetchAPI(`projects/${selectedProjectId}/documents/${docId}`, { method: 'DELETE' });
      if (res.success) {
        setSuccess('Xóa tài liệu thành công!');
        loadDocuments(selectedProjectId);
      } else {
        setError(res.message || 'Lỗi xóa tài liệu');
      }
    } catch (e: any) {
      setError(e.message || 'Lỗi kết nối');
    }
  };

  const handleDownloadDoc = (docId: number) => {
    if (!selectedProjectId) return;
    const token = localStorage.getItem('access_token') || localStorage.getItem('richland_token') || '';
    const url = `${import.meta.env.VITE_API_URL || '/backend'}/api.php?action=projects/${selectedProjectId}/documents/${docId}/download&token=${token}`;
    window.open(url, '_blank');
  };

  return (
    <div className="page-container anim-fade-up" style={{ color: 'var(--color-text)' }}>
      {/* Notifications */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button className="ml-auto" onClick={() => setError('')}><X size={16} /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-lg">
          <Check size={20} />
          <span>{success}</span>
          <button className="ml-auto" onClick={() => setSuccess('')}><X size={16} /></button>
        </div>
      )}

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
              setEditingCampaign({ name: '', description: '', status: 'active' });
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
                    <div className="flex items-center gap-3">
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
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--color-bg)', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>
                      <Users size={12} /> {proj.roster_count || 0} nhân sự
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--color-bg)', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>
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
                                  style={{ color: 'var(--color-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600 }}
                                  onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                                  onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                                >
                                  • {fileObj.name}
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
                      <div className="flex items-center gap-3">
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
        <div className="overlay-backdrop" onClick={() => setIsEditModalOpen(false)} style={{ zIndex: 1000 }}>
          <div className="modal-sheet modal-md" onClick={e => e.stopPropagation()} style={{ animation: 'scaleUp 0.2s ease-out', maxWidth: '650px', width: '100%' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, color: 'var(--color-text)' }}>{editingProject?.id ? 'Chỉnh sửa dự án' : 'Thêm dự án mới'}</h3>
              <button onClick={() => setIsEditModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveProject}>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
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
                  <label className="form-label">Tài liệu liên kết</label>
                  <CustomSelect
                    multiple
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
                    options={campaigns.map(c => ({ value: c.name, label: c.name }))}
                    value={parseIds(editingProject?.campaign_ids)}
                    onChange={val => setEditingProject(prev => ({ ...prev, campaign_ids: Array.isArray(val) ? val.join(',') : String(val) }))}
                    placeholder="Chọn chiến dịch liên kết..."
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
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setIsEditModalOpen(false)}>Hủy</button>
                <button type="submit" className="btn primary">Lưu dự án</button>
              </div>
            </form>
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
        <div className="overlay-backdrop" onClick={() => setIsCampaignModalOpen(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 1100 }}>
          <div className="card" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', display: 'flex', flexDirection: 'column', animation: 'modalSpring 0.4s cubic-bezier(0.34, 1.18, 0.64, 1) both', margin: 'auto', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', borderBottom: '1px solid var(--color-border-light)' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
                {editingCampaign?.id ? 'Chỉnh sửa Chiến dịch' : 'Thêm Chiến dịch mới'}
              </h3>
              <button type="button" onClick={() => setIsCampaignModalOpen(false)} style={{ color: 'var(--color-text-muted)', padding: 4, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCampaign} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
