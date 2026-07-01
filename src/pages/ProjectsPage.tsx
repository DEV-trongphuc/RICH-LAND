import React, { useEffect, useState } from 'react';
import { fetchAPI } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Users, FileText, Plus, Trash2, Edit, X, Upload, Download, Check, AlertCircle } from 'lucide-react';
import { EmptyCard } from '../components/ui/EmptyCard';

interface Project {
  id: number;
  name: string;
  code: string;
  description: string;
  status: string;
  created_at: string;
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
    if (!editingProject?.name || !editingProject?.code) {
      setError('Tên và mã dự án là bắt buộc');
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
      const token = localStorage.getItem('richland_token') || '';
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
    const token = localStorage.getItem('richland_token') || '';
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
                      <span className="text-xs text-gray-500 font-mono">Mã: {proj.code}</span>
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
                <p className="text-sm text-gray-400 line-clamp-3 mb-6" style={{ color: 'var(--color-text-muted)' }}>{proj.description || 'Không có mô tả'}</p>
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
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-800">
              <h2 className="text-xl font-bold">{editingProject?.id ? 'Chỉnh sửa dự án' : 'Thêm dự án mới'}</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveProject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Tên dự án</label>
                <input
                  type="text"
                  required
                  value={editingProject?.name || ''}
                  onChange={e => setEditingProject(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-black/40 border border-gray-800 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Mã dự án</label>
                <input
                  type="text"
                  required
                  value={editingProject?.code || ''}
                  onChange={e => setEditingProject(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  className="w-full bg-black/40 border border-gray-800 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Mô tả chi tiết</label>
                <textarea
                  value={editingProject?.description || ''}
                  onChange={e => setEditingProject(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-black/40 border border-gray-800 rounded-lg px-3 py-2 text-sm h-24 resize-none focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Trạng thái bán</label>
                <select
                  value={editingProject?.status || 'active'}
                  onChange={e => setEditingProject(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full bg-black/40 border border-gray-800 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="active">Đang mở bán</option>
                  <option value="inactive">Tạm dừng bán</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-primary hover:opacity-90 transition-opacity font-bold rounded-lg text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                Lưu dự án
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Roster Modal */}
      {isRosterModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-800">
              <h2 className="text-xl font-bold">Cấu hình Roster Nhân Sự Phân Phối</h2>
              <button onClick={() => setIsRosterModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
              {rosterMembers.length === 0 ? (
                <div className="text-center py-6 text-gray-500">Không tìm thấy tài khoản Sales khả dụng</div>
              ) : (
                rosterMembers.map(member => (
                  <div
                    key={member.id}
                    onClick={() => handleToggleRoster(member.id)}
                    className={`flex justify-between items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                      member.is_assigned ? 'border-primary/50 bg-primary/5' : 'border-gray-800 bg-black/20 hover:border-gray-700'
                    }`}
                  >
                    <div>
                      <h4 className="font-bold text-sm">{member.full_name}</h4>
                      <p className="text-xs text-gray-500">{member.email}</p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                        member.is_assigned ? 'bg-primary border-primary text-white' : 'border-gray-700'
                      }`}
                      style={member.is_assigned ? { backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-primary)' } : {}}
                    >
                      {member.is_assigned === 1 && <Check size={14} />}
                    </div>
                  </div>
                ))
              )}
            </div>
            <button
              onClick={handleSaveRoster}
              className="w-full py-2 bg-primary hover:opacity-90 font-bold rounded-lg text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              Lưu thay đổi roster
            </button>
          </div>
        </div>
      )}

      {/* Documents Modal */}
      {isDocsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-xl w-full p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-800">
              <h2 className="text-xl font-bold">Kho Tài Liệu Dự Án (Mật)</h2>
              <button onClick={() => setIsDocsModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>

            {/* Upload Area for Admins */}
            {isAdmin && (
              <div className="p-4 border border-dashed border-gray-800 rounded-lg flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm">Tải tài liệu mới lên</h4>
                  <p className="text-xs text-gray-500">Chấp nhận file PDF, Word, Excel, Hình ảnh</p>
                </div>
                <label className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg font-bold text-xs cursor-pointer text-white">
                  <Upload size={14} />
                  {uploadingDoc ? 'Đang tải...' : 'Chọn file'}
                  <input type="file" disabled={uploadingDoc} onChange={handleUploadFile} className="hidden" />
                </label>
              </div>
            )}

            {/* List */}
            <div className="max-h-72 overflow-y-auto space-y-2 pr-2">
              {projectDocs.length === 0 ? (
                <div className="text-center py-12 text-gray-500">Chưa có tài liệu nào cho dự án này</div>
              ) : (
                projectDocs.map(doc => (
                  <div
                    key={doc.id}
                    className="flex justify-between items-center p-3 bg-black/20 border border-gray-800 rounded-lg"
                  >
                    <div>
                      <h4 className="font-bold text-sm text-gray-200 line-clamp-1">{doc.name}</h4>
                      <p className="text-xs text-gray-500">
                        {doc.uploaded_by_name} • {(doc.file_size / 1024 / 1024).toFixed(2)} MB • {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleDownloadDoc(doc.id)}
                        className="p-1.5 bg-gray-800 hover:bg-gray-700 text-primary rounded-md"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        <Download size={14} />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteDoc(doc.id)}
                          className="p-1.5 bg-gray-800 hover:bg-red-500/20 text-red-500 rounded-md"
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
        </div>
      )}
    </div>
  );
}
