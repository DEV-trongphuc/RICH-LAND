import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchAPI } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Users, FileText, Plus, Trash2, Edit, X, Upload, Download, Check, AlertCircle } from 'lucide-react';
import { EmptyCard } from '../components/ui/EmptyCard';
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  useEffect(() => {
    loadProjects();
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
    const formData = new FormData();
    formData.append('file', file);

    setUploadingDoc(true);
    try {
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
        {isAdmin && (
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
      </div>

      {/* Projects List */}
      {loading ? (
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
                    <div className="p-3 bg-primary/10 rounded-lg text-primary" style={{ color: 'var(--color-primary)' }}>
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
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', fontSize: '0.75rem', color: 'var(--color-text-light)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--color-bg)', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>
                    <Users size={12} /> {proj.roster_count || 0} nhân sự
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--color-bg)', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>
                    <FileText size={12} /> {proj.doc_count || 0} tài liệu
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
                <button
                  onClick={() => handleOpenDocs(proj.id)}
                  className="btn secondary sm flex-1 flex justify-center items-center gap-1.5"
                >
                  <FileText size={14} />
                  Tài liệu
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
      )}

      {/* Edit Modal */}
      {isEditModalOpen && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)', padding: '1rem' }}>
          <div className="modal-sheet modal-md" style={{ animation: 'scaleUp 0.2s ease-out', maxWidth: '650px', width: '100%' }}>
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
                  <input
                    type="text"
                    value={editingProject?.developer || ''}
                    onChange={e => setEditingProject(prev => ({ ...prev, developer: e.target.value }))}
                    className="form-input"
                    placeholder="Ví dụ: Vingroup, Novaland..."
                  />
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)', padding: '1rem' }}>
          <div className="modal-sheet modal-md" style={{ animation: 'scaleUp 0.2s ease-out' }}>
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)', padding: '1rem' }}>
          <div className="modal-sheet modal-md" style={{ animation: 'scaleUp 0.2s ease-out' }}>
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
    </div>
  );
}
