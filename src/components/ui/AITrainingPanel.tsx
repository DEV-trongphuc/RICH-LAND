import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Sparkles, Database, FileText, Globe, Upload, Trash2, Edit2, Play, 
  RefreshCw, Send, Sliders, MessageSquare, Plus, Info, X, 
  ChevronRight, ChevronDown, Folder, FolderPlus, CornerDownRight,
  Bot, User, SlidersHorizontal, Settings
} from 'lucide-react';
import { fetchAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import { EmptyCard } from './EmptyCard';
import { CustomSelect } from './CustomSelect';

interface AIDoc {
  id: string;
  name: string;
  source_type: 'upload' | 'file' | 'web' | 'manual' | 'folder';
  status: 'pending' | 'trained' | 'error' | 'processing';
  created_at: string;
  updated_at?: string;
  tags?: string;
  content?: string;
  parent_id?: string;
  is_active?: number;
  created_by?: string;
  version?: number;
}

interface RAGSettings {
  is_enabled: number;
  bot_name: string;
  welcome_msg: string;
  persona_prompt: string;
  similarity_threshold: number;
  top_k: number;
  chunk_size: number;
  chunk_overlap: number;
  temperature: number;
  max_output_tokens: number;
  history_limit: number;
  brand_color: string;
}

const formatDocDate = (dateStr?: string) => {
  if (!dateStr) return '—';
  const t = dateStr.split(/[- :T.]/);
  if (t.length >= 5) {
    return `${t[3]}:${t[4]} ${t[2]}/${t[1]}/${t[0]}`;
  }
  return dateStr;
};

const ToggleSwitch = React.memo(({ active, onChange, disabled }: { active: boolean; onChange: () => void; disabled?: boolean }) => (
  <div 
    onClick={(e) => { e.stopPropagation(); if (!disabled) onChange(); }}
    style={{
      width: '36px',
      height: '20px',
      borderRadius: '10px',
      backgroundColor: active ? '#10b981' : 'var(--color-border)',
      padding: '2px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      transition: 'background-color 0.2s',
      opacity: disabled ? 0.5 : 1
    }}
  >
    <div style={{
      width: '16px',
      height: '16px',
      borderRadius: '50%',
      backgroundColor: 'white',
      transform: active ? 'translateX(16px)' : 'translateX(0px)',
      transition: 'transform 0.2s',
      boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
    }} />
  </div>
));

const RAGSlider = ({ 
  label, 
  value, 
  min, 
  max, 
  step, 
  unit, 
  description,
  onChange 
}: { 
  label: string; 
  value: number; 
  min: number; 
  max: number; 
  step: number; 
  unit: string; 
  description?: string;
  onChange: (val: number) => void;
}) => {
  const pct = ((value - min) / (max - min)) * 100;
  const midValue = min + (max - min) / 2;
  const formatVal = (v: number) => {
    if (step < 1) return v.toFixed(2);
    return Math.round(v).toString();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-light)' }}>
          {label}
        </label>
        <div style={{
          background: 'white',
          border: '1px solid var(--color-border)',
          borderRadius: '6px',
          padding: '4px 10px',
          fontSize: '0.8125rem',
          fontWeight: 700,
          color: '#BD1D2D',
          display: 'inline-flex',
          alignItems: 'center',
          minWidth: '55px',
          justifyContent: 'center',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
        }}>
          {value} <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginLeft: '2px' }}>{unit}</span>
        </div>
      </div>

      <div style={{ position: 'relative', width: '100%' }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          className="rag-premium-slider"
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            background: `linear-gradient(to right, #BD1D2D 0%, #f97316 ${pct}%, #f1f5f9 ${pct}%, #f1f5f9 100%)`
          }}
        />
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.6875rem',
          color: '#94a3b8',
          marginTop: '4px',
          padding: '0 2px',
          fontWeight: 600
        }}>
          <span>{formatVal(min)}{unit}</span>
          <span>{formatVal(midValue)}{unit}</span>
          <span>{formatVal(max)}{unit}</span>
        </div>
      </div>
      {description && (
        <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
          {description}
        </span>
      )}
    </div>
  );
};

export const AITrainingPanel: React.FC = () => {
  const [subtab, setSubtab] = useState<'docs' | 'rag' | 'sandbox'>('docs');
  const [docs, setDocs] = useState<AIDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [trainingDocs, setTrainingDocs] = useState<Record<string, boolean>>({});
  const [trainingProgress, setTrainingProgress] = useState<Record<string, string>>({});
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  // RAG Settings State
  const [settings, setSettings] = useState<RAGSettings>({
    is_enabled: 1,
    bot_name: 'AI Rich Land',
    welcome_msg: 'Chào bạn! Tôi có thể giúp gì cho bạn hôm nay?',
    persona_prompt: 'Bạn là chuyên viên tư vấn nhiệt tình của Richland.',
    similarity_threshold: 0.45,
    top_k: 8,
    chunk_size: 700,
    chunk_overlap: 150,
    temperature: 0.2,
    max_output_tokens: 1024,
    history_limit: 10,
    brand_color: '#BD1D2D'
  });
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const getSliderStyle = (val: number, min: number, max: number) => {
    const pct = ((val - min) / (max - min)) * 100;
    return {
      background: `linear-gradient(to right, #BD1D2D 0%, #BD1D2D ${pct}%, #e2e8f0 ${pct}%, #e2e8f0 100%)`
    };
  };

  // Ingestion Modal States
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showWebModal, setShowWebModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<AIDoc | null>(null);

  // Context Selection Modal States
  const [showContextModal, setShowContextModal] = useState(false);
  const [contextTab, setContextTab] = useState<'project' | 'campaign'>('project');
  const [contextSearchQuery, setContextSearchQuery] = useState('');
  const [selectedContextLabel, setSelectedContextLabel] = useState('Không kèm ngữ cảnh (Chat chung)');

  // Form inputs
  const [manualTitle, setManualTitle] = useState('');
  const [manualContent, setManualContent] = useState('');
  const [manualTags, setManualTags] = useState('');
  const [manualFolderId, setManualFolderId] = useState('');
  const [submittingManual, setSubmittingManual] = useState(false);

  const [webTitle, setWebTitle] = useState('');
  const [webUrl, setWebUrl] = useState('');
  const [webTags, setWebTags] = useState('');
  const [webFolderId, setWebFolderId] = useState('');
  const [submittingWeb, setSubmittingWeb] = useState(false);

  const [folderName, setFolderName] = useState('');
  const [submittingFolder, setSubmittingFolder] = useState(false);

  // File Upload State
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadFolderId, setUploadFolderId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  // Sandbox State
  const [sandboxMessages, setSandboxMessages] = useState<any[]>([
    { id: '1', sender: 'bot', text: 'Chào anh/chị! Đây là Sandbox để thử nghiệm tri thức AI. Nhập câu hỏi bên dưới để xem AI trả lời thế nào sau khi được huấn luyện.', timestamp: new Date() }
  ]);
  const [sandboxInput, setSandboxInput] = useState('');
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [campaignsList, setCampaignsList] = useState<any[]>([]);
  const [selectedProjectContext, setSelectedProjectContext] = useState<string>('');
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchDocs();
    fetchRAGSettings();
    loadProjects();
    loadCampaigns();
  }, []);

  useEffect(() => {
    if (subtab === 'sandbox') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [sandboxMessages, sandboxLoading, subtab]);

  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
      const res = await fetchAPI('projects');
      const list = Array.isArray(res) ? res : (res?.data || []);
      setProjectsList(list);
    } catch (e) {
      console.error('Failed to load projects for sandbox:', e);
    } finally {
      setLoadingProjects(false);
    }
  };

  const loadCampaigns = async () => {
    setLoadingCampaigns(true);
    try {
      const res = await fetchAPI('campaigns');
      const list = res.success ? (res.data || []) : (Array.isArray(res) ? res : []);
      setCampaignsList(list);
    } catch (e) {
      console.error('Failed to load campaigns for sandbox:', e);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const fetchDocs = async () => {
    setLoadingDocs(true);
    try {
      const res = await fetchAPI('ai_training', {
        method: 'POST',
        body: JSON.stringify({ action: 'list_docs', property_id: 'richland' })
      });
      if (res && res.success) {
        setDocs(res.data || []);
      } else {
        setDocs([]);
      }
    } catch (e) {
      console.error('Failed to fetch training documents:', e);
    } finally {
      setLoadingDocs(false);
    }
  };

  const fetchRAGSettings = async () => {
    setLoadingSettings(true);
    try {
      const res = await fetchAPI('ai_training', {
        method: 'POST',
        body: JSON.stringify({ action: 'get_settings', property_id: 'richland' })
      });
      if (res && res.success && res.data) {
        setSettings({
          is_enabled: Number(res.data.is_enabled ?? 1),
          bot_name: res.data.bot_name || 'AI Rich Land',
          welcome_msg: res.data.welcome_msg || 'Chào bạn! Tôi có thể giúp gì cho bạn hôm nay?',
          persona_prompt: res.data.persona_prompt || 'Bạn là trợ lý ảo chuyên nghiệp.',
          similarity_threshold: Number(res.data.similarity_threshold ?? 0.45),
          top_k: Number(res.data.top_k ?? 8),
          chunk_size: Number(res.data.chunk_size ?? 700),
          chunk_overlap: Number(res.data.chunk_overlap ?? 150),
          temperature: Number(res.data.temperature ?? 0.2),
          max_output_tokens: Number(res.data.max_output_tokens ?? 1024),
          history_limit: Number(res.data.history_limit ?? 10),
          brand_color: res.data.brand_color || '#BD1D2D'
        });
      }
    } catch (e) {
      console.error('Failed to fetch RAG settings:', e);
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetchAPI('ai_training', {
        method: 'POST',
        body: JSON.stringify({
          action: 'update_settings',
          property_id: 'richland',
          ...settings
        })
      });
      if (res && res.success) {
        toast.success('Đã cập nhật cấu hình RAG thành công!');
      } else {
        toast.error(res?.message || 'Không thể lưu cấu hình');
      }
    } catch (e: any) {
      toast.error('Lỗi khi lưu cấu hình: ' + e.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      toast.error('Vui lòng nhập tên thư mục');
      return;
    }
    setSubmittingFolder(true);
    try {
      const res = await fetchAPI('ai_training', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create_folder',
          property_id: 'richland',
          name: folderName
        })
      });
      if (res && res.success) {
        toast.success('Đã tạo thư mục thành công!');
        setFolderName('');
        setShowFolderModal(false);
        fetchDocs();
      } else {
        toast.error(res?.message || 'Thất bại');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    } finally {
      setSubmittingFolder(false);
    }
  };

  const handleAddManual = async () => {
    if (!manualTitle.trim() || !manualContent.trim()) {
      toast.error('Vui lòng nhập đầy đủ tiều đề và nội dung');
      return;
    }
    setSubmittingManual(true);
    try {
      const res = await fetchAPI('ai_training', {
        method: 'POST',
        body: JSON.stringify({
          action: 'add_manual',
          property_id: 'richland',
          name: manualTitle,
          content: manualContent,
          tags: manualTags,
          batch_id: manualFolderId || '0'
        })
      });
      if (res && res.success) {
        toast.success('Đã lưu văn bản nhập tay');
        setManualTitle('');
        setManualContent('');
        setManualTags('');
        setManualFolderId('');
        setShowManualModal(false);
        fetchDocs();
      } else {
        toast.error(res?.message || 'Thất bại');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    } finally {
      setSubmittingManual(false);
    }
  };

  const handleAddWeb = async () => {
    if (!webTitle.trim() || !webUrl.trim()) {
      toast.error('Vui lòng nhập đầy đủ tên và đường dẫn website');
      return;
    }
    setSubmittingWeb(true);
    try {
      const res = await fetchAPI('ai_training', {
        method: 'POST',
        body: JSON.stringify({
          action: 'add_manual',
          property_id: 'richland',
          name: webTitle,
          content: `URL_TO_CRAWL: ${webUrl}`,
          tags: webTags,
          batch_id: webFolderId || '0'
        })
      });
      if (res && res.success) {
        toast.success('Đã thêm liên kết cào dữ liệu');
        setWebTitle('');
        setWebUrl('');
        setWebTags('');
        setWebFolderId('');
        setShowWebModal(false);
        fetchDocs();
      } else {
        toast.error(res?.message || 'Thất bại');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    } finally {
      setSubmittingWeb(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      toast.error('Kích thước file vượt quá giới hạn 25MB');
      return;
    }

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('action', 'upload_training_file');
      formData.append('property_id', 'richland');
      if (uploadFolderId) {
        formData.append('folder_id', uploadFolderId);
      }

      const res = await fetchAPI('ai_training', {
        method: 'POST',
        body: formData
      });

      if (res && res.success) {
        toast.success('Đã tải lên tài liệu thành công!');
        setShowUploadModal(false);
        fetchDocs();
      } else {
        toast.error(res?.message || 'Tải file thất bại');
      }
    } catch (e: any) {
      toast.error('Lỗi khi tải file: ' + e.message);
    } finally {
      setUploadingFile(false);
      setUploadFolderId('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleTrainDoc = async (docId: string) => {
    setTrainingDocs(prev => ({ ...prev, [docId]: true }));
    setTrainingProgress(prev => ({ ...prev, [docId]: 'Đang đọc...' }));

    const t1 = setTimeout(() => {
      setTrainingProgress(prev => ({ ...prev, [docId]: 'Trích xuất...' }));
    }, 300);

    const t2 = setTimeout(() => {
      setTrainingProgress(prev => ({ ...prev, [docId]: 'Tạo vector...' }));
    }, 600);

    const t3 = setTimeout(() => {
      setTrainingProgress(prev => ({ ...prev, [docId]: 'Lưu RAG...' }));
    }, 900);

    try {
      const res = await fetchAPI('ai_training', {
        method: 'POST',
        body: JSON.stringify({
          action: 'train_docs',
          property_id: 'richland',
          doc_ids: [docId]
        })
      });

      await new Promise(resolve => setTimeout(resolve, 1200));

      if (res && res.success) {
        toast.success('Huấn luyện thành công!');
        fetchDocs();
      } else {
        toast.error(res?.message || 'Huấn luyện thất bại');
      }
    } catch (e: any) {
      toast.error('Lỗi huấn luyện: ' + e.message);
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      setTrainingDocs(prev => ({ ...prev, [docId]: false }));
      setTrainingProgress(prev => {
        const copy = { ...prev };
        delete copy[docId];
        return copy;
      });
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa tài liệu huấn luyện này? Chunks vector tương ứng cũng sẽ bị loại bỏ.')) {
      return;
    }
    try {
      const res = await fetchAPI('ai_training', {
        method: 'POST',
        body: JSON.stringify({
          action: 'delete_doc',
          property_id: 'richland',
          doc_id: docId
        })
      });
      if (res && res.success) {
        toast.success('Đã xóa tài liệu');
        fetchDocs();
      } else {
        toast.error(res?.message || 'Xóa thất bại');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa toàn bộ thư mục này? Tất cả tài liệu con cũng sẽ bị xóa.')) {
      return;
    }
    try {
      const res = await fetchAPI('ai_training', {
        method: 'POST',
        body: JSON.stringify({
          action: 'delete_batch',
          property_id: 'richland',
          batch_id: folderId
        })
      });
      if (res && res.success) {
        toast.success('Đã xóa thư mục');
        fetchDocs();
      } else {
        toast.error(res?.message || 'Xóa thất bại');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
  };

  const handleToggleDoc = async (docId: string, currentStatus: number) => {
    const nextStatus = currentStatus === 1 ? 0 : 1;
    try {
      const res = await fetchAPI('ai_training', {
        method: 'POST',
        body: JSON.stringify({
          action: 'update_doc',
          property_id: 'richland',
          id: docId,
          is_active: nextStatus
        })
      });
      if (res && res.success) {
        toast.success(nextStatus ? 'Đã kích hoạt tri thức' : 'Đã dừng sử dụng tri thức');
        fetchDocs();
      } else {
        toast.error(res?.message || 'Thất bại');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
  };

  const handleToggleFolder = async (folderId: string, currentStatus: number) => {
    const nextStatus = currentStatus === 1 ? 0 : 1;
    try {
      const res = await fetchAPI('ai_training', {
        method: 'POST',
        body: JSON.stringify({
          action: 'toggle_batch',
          property_id: 'richland',
          batch_id: folderId,
          is_active: nextStatus
        })
      });
      if (res && res.success) {
        toast.success(nextStatus ? 'Đã kích hoạt toàn bộ thư mục' : 'Đã dừng sử dụng toàn bộ thư mục');
        fetchDocs();
      } else {
        toast.error(res?.message || 'Thất bại');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
  };

  const handleEditDoc = (doc: AIDoc) => {
    setEditingDoc(doc);
    setShowEditModal(true);
  };

  const handleUpdateDoc = async () => {
    if (!editingDoc) return;
    try {
      const res = await fetchAPI('ai_training', {
        method: 'POST',
        body: JSON.stringify({
          action: 'update_doc',
          property_id: 'richland',
          id: editingDoc.id,
          name: editingDoc.name,
          content: editingDoc.content || '',
          tags: editingDoc.tags || '',
          parent_id: editingDoc.parent_id || '0'
        })
      });
      if (res && res.success) {
        toast.success('Cập nhật tài liệu thành công!');
        setShowEditModal(false);
        setEditingDoc(null);
        fetchDocs();
      } else {
        toast.error(res?.message || 'Cập nhật thất bại');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
  };

  const handleSendSandbox = async () => {
    if (!sandboxInput.trim() || sandboxLoading) return;
    const userMsg = sandboxInput;
    setSandboxInput('');
    setSandboxMessages(prev => [...prev, { id: Date.now().toString(), sender: 'user', text: userMsg, timestamp: new Date() }]);
    setSandboxLoading(true);

    try {
      const historyPayload = sandboxMessages
        .slice(-8)
        .filter(msg => msg.id !== '1')
        .map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'model',
          text: msg.text
        }));

      const res = await fetchAPI('ai_chat', {
        method: 'POST',
        body: JSON.stringify({
          message: userMsg,
          history: historyPayload,
          project_context: selectedProjectContext
        })
      });

      if (res && res.success && res.data && res.data.reply) {
        setSandboxMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'bot', text: res.data.reply, timestamp: new Date() }]);
      } else {
        setSandboxMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'bot', text: 'Xin lỗi, tôi gặp sự cố kết nối máy chủ hoặc API Key bị lỗi.', timestamp: new Date() }]);
      }
    } catch (e: any) {
      console.error(e);
      setSandboxMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'bot', text: 'Lỗi hệ thống: ' + e.message, timestamp: new Date() }]);
    } finally {
      setSandboxLoading(false);
    }
  };

  const toggleFolderExpand = (folderId: string) => {
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  // Grouping logic for folder structure
  const groupedDocs = React.useMemo(() => {
    const folders: Record<string, AIDoc & { isGroup: boolean; members: AIDoc[] }> = {};
    const rootDocs: AIDoc[] = [];

    // Filter by search and type filter
    const activeDocs = docs.filter(d => {
      const matchSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) || (d.tags && d.tags.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchFilter = filterType === 'all' ? true : d.source_type === filterType;
      return matchSearch && matchFilter;
    });

    // Pass 1: Identify all folder items
    docs.forEach(doc => {
      if (doc.source_type === 'folder') {
        folders[doc.id] = { ...doc, isGroup: true, members: [] };
      }
    });

    // Pass 2: Distribute docs
    activeDocs.forEach(doc => {
      if (doc.source_type === 'folder') return;
      const parentId = doc.parent_id && doc.parent_id !== '0' ? doc.parent_id : null;
      if (parentId && folders[parentId]) {
        folders[parentId].members.push(doc);
      } else {
        rootDocs.push(doc);
      }
    });

    // If filter or search is active, do not show empty folders
    const folderList = Object.values(folders).filter(f => {
      if (searchTerm || filterType !== 'all') {
        return f.members.length > 0;
      }
      return true;
    });

    return [...folderList, ...rootDocs];
  }, [docs, searchTerm, filterType]);

  const folderOptions = docs.filter(d => d.source_type === 'folder');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Sleek Custom Sliders Styling */}
      <style>{`
        .custom-slider {
          -webkit-appearance: none;
          width: 100%;
          height: 6px;
          border-radius: 3px;
          outline: none;
          margin: 10px 0;
        }
        .custom-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #BD1D2D !important;
          border: 2px solid #fff !important;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(189, 29, 45, 0.4);
          transition: transform 0.1s, background-color 0.2s;
        }
        .custom-slider::-webkit-slider-thumb:hover {
          transform: scale(1.25);
          background: #a31422 !important;
        }
        .custom-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #BD1D2D !important;
          border: 2px solid #fff !important;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(189, 29, 45, 0.4);
          transition: transform 0.1s, background-color 0.2s;
        }
        .custom-slider::-moz-range-thumb:hover {
          transform: scale(1.25);
          background: #a31422 !important;
        }

        .rag-premium-slider {
          -webkit-appearance: none;
          width: 100%;
          height: 12px;
          border-radius: 6px;
          outline: none;
          margin: 6px 0;
          cursor: pointer;
        }
        .rag-premium-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 8px;
          height: 12px;
          border-radius: 4px;
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          transition: transform 0.1s;
        }
        .rag-premium-slider::-webkit-slider-thumb:hover {
          transform: scaleY(1.15) scaleX(1.1);
        }
        .rag-premium-slider::-moz-range-thumb {
          width: 8px;
          height: 12px;
          border-radius: 4px;
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          transition: transform 0.1s;
        }
        .rag-premium-slider::-moz-range-thumb:hover {
          transform: scaleY(1.15) scaleX(1.1);
        }

        .resizable-textarea-wrapper {
          resize: vertical;
          overflow: hidden;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .resizable-textarea-wrapper:focus-within {
          border-color: var(--color-primary) !important;
          box-shadow: 0 0 0 4px var(--color-primary-glow) !important;
        }
        .document-editor-textarea {
          width: 100% !important;
          height: 100% !important;
          flex: 1 !important;
          min-height: unset !important;
          resize: none !important;
          border: none !important;
          outline: none !important;
          padding: 0 !important;
          background: transparent !important;
          font-size: 0.9375rem !important;
          line-height: 1.6 !important;
          font-family: inherit !important;
          color: var(--color-text) !important;
        }
        .document-editor-textarea:focus {
          box-shadow: none !important;
          border: none !important;
          outline: none !important;
        }
      `}</style>
      {/* Subtab Navigation */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--color-border-light)',
        paddingBottom: '0.5rem',
        gap: '1.5rem',
        marginBottom: '1rem'
      }}>
        <button
          type="button"
          onClick={() => setSubtab('docs')}
          style={{
            background: 'none',
            border: 'none',
            padding: '8px 12px',
            fontSize: '0.875rem',
            fontWeight: 700,
            cursor: 'pointer',
            color: subtab === 'docs' ? '#BD1D2D' : 'var(--color-text-muted)',
            borderBottom: subtab === 'docs' ? '2.5px solid #BD1D2D' : '2.5px solid transparent',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <Folder size={16} />
          Kho Tài Liệu RAG
        </button>
        <button
          type="button"
          onClick={() => setSubtab('rag')}
          style={{
            background: 'none',
            border: 'none',
            padding: '8px 12px',
            fontSize: '0.875rem',
            fontWeight: 700,
            cursor: 'pointer',
            color: subtab === 'rag' ? '#BD1D2D' : 'var(--color-text-muted)',
            borderBottom: subtab === 'rag' ? '2.5px solid #BD1D2D' : '2.5px solid transparent',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <Sliders size={16} />
          Thông số RAG & Cấu hình
        </button>
        <button
          type="button"
          onClick={() => setSubtab('sandbox')}
          style={{
            background: 'none',
            border: 'none',
            padding: '8px 12px',
            fontSize: '0.875rem',
            fontWeight: 700,
            cursor: 'pointer',
            color: subtab === 'sandbox' ? '#BD1D2D' : 'var(--color-text-muted)',
            borderBottom: subtab === 'sandbox' ? '2.5px solid #BD1D2D' : '2.5px solid transparent',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <MessageSquare size={16} />
          Live Sandbox (Thử nghiệm)
        </button>
      </div>

      {/* Tab Content: HUẤN LUYỆN TRÍ THỨC (DOCS) */}
      {subtab === 'docs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Quick Actions Button Bar */}
          <div style={{
            display: 'flex',
            gap: '0.75rem',
            flexWrap: 'wrap',
            marginBottom: '0.5rem',
            justifyContent: 'flex-end'
          }}>
            <button 
              type="button"
              className="btn primary sm" 
              onClick={() => setShowUploadModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: '36px', background: '#BD1D2D', borderColor: '#BD1D2D' }}
            >
              <Upload size={14} />
              Tải tệp tin
            </button>
            <button 
              type="button"
              className="btn outline sm"
              onClick={() => setShowManualModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: '36px' }}
            >
              <Plus size={14} />
              Nhập thủ công (Q&A)
            </button>
            <button 
              type="button"
              className="btn outline sm"
              onClick={() => setShowWebModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: '36px' }}
            >
              <Globe size={14} />
              Cào website
            </button>
            <button 
              type="button"
              className="btn outline sm"
              onClick={() => setShowFolderModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: '36px' }}
            >
              <FolderPlus size={14} />
              Tạo thư mục
            </button>
          </div>

          {/* Search, Filter & Table */}
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Tìm kiếm tài liệu, tags tri thức..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ flex: 1, minWidth: '220px' }}
              />
              <CustomSelect
                options={[
                  { value: 'all', label: 'Tất cả định dạng' },
                  { value: 'upload', label: 'Tệp tải lên' },
                  { value: 'manual', label: 'Nhập thủ công' },
                  { value: 'web', label: 'Website cào' },
                  { value: 'folder', label: 'Thư mục' }
                ]}
                value={filterType}
                onChange={val => setFilterType(val || 'all')}
                searchable={false}
                placeholder="Định dạng..."
                width="160px"
              />
              <button type="button" className="btn outline" onClick={fetchDocs} disabled={loadingDocs} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <RefreshCw size={14} className={loadingDocs ? 'spin' : ''} />
                Làm mới
              </button>
            </div>

            {/* Folders & Documents Tree Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 8px', color: 'var(--color-text-muted)', fontWeight: 800, width: '30%' }}>TÊN TRI THỨC / THƯ MỤC</th>
                    <th style={{ padding: '12px 8px', color: 'var(--color-text-muted)', fontWeight: 800, width: '10%' }}>ĐỊNH DẠNG</th>
                    <th style={{ padding: '12px 8px', color: 'var(--color-text-muted)', fontWeight: 800, width: '15%' }}>TAGS / MỤC CON</th>
                    <th style={{ padding: '12px 8px', color: 'var(--color-text-muted)', fontWeight: 800, width: '12%' }}>TRẠNG THÁI</th>
                    <th style={{ padding: '12px 8px', color: 'var(--color-text-muted)', fontWeight: 800, width: '15%' }}>CẬP NHẬT</th>
                    <th style={{ padding: '12px 8px', color: 'var(--color-text-muted)', fontWeight: 800, width: '8%' }}>KÍCH HOẠT</th>
                    <th style={{ padding: '12px 8px', color: 'var(--color-text-muted)', fontWeight: 800, textAlign: 'right', width: '10%', minWidth: '150px' }}>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingDocs ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px auto' }} />
                        Đang tải danh sách tri thức từ hệ thống...
                      </td>
                    </tr>
                  ) : groupedDocs.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '2.5rem 1rem' }}>
                        <EmptyCard
                          icon={<Database size={36} color="#BD1D2D" />}
                          title="Không tìm thấy tài liệu tri thức nào"
                          description="Hệ thống chưa học dữ liệu nào cho Richland. Hãy nạp tài liệu từ file, nhập tay hoặc cào liên kết website ở trên để bắt đầu huấn luyện AI."
                        />
                      </td>
                    </tr>
                  ) : (
                    groupedDocs.map(row => {
                      const isFolder = row.source_type === 'folder';
                      const isExpanded = !!expandedFolders[row.id];

                      if (isFolder) {
                        const members = (row as any).members || [];
                        const activeCount = members.filter((m: any) => Number(m.is_active) === 1).length;
                        const isFolderActive = activeCount > 0;

                        return (
                          <React.Fragment key={row.id}>
                            {/* Folder Row */}
                            <tr 
                              onClick={() => toggleFolderExpand(row.id)}
                              style={{ borderBottom: '1px solid var(--color-border-light)', background: 'rgba(245, 158, 11, 0.02)', cursor: 'pointer' }}
                            >
                              <td style={{ padding: '12px 8px', fontWeight: 700, color: 'var(--color-text)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                  <Folder size={18} color="#f59e0b" fill="#f59e0b" />
                                  <span>{row.name}</span>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>
                                    ({activeCount}/{members.length} hoạt động)
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding: '12px 8px' }}>
                                <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.08)', color: '#f59e0b', fontSize: '0.75rem', fontWeight: 700 }}>
                                  Thư mục
                                </span>
                              </td>
                              <td style={{ padding: '12px 8px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                                {members.length} tài liệu
                              </td>
                              <td style={{ padding: '12px 8px' }}>—</td>
                              <td style={{ padding: '12px 8px', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                                {formatDocDate(row.updated_at)}
                              </td>
                              <td style={{ padding: '12px 8px' }} onClick={e => e.stopPropagation()}>
                                <ToggleSwitch 
                                  active={isFolderActive} 
                                  onChange={() => handleToggleFolder(row.id, isFolderActive ? 1 : 0)} 
                                />
                              </td>
                              <td style={{ padding: '12px 8px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                                <button 
                                  type="button"
                                  className="btn outline sm text-danger" 
                                  onClick={() => handleDeleteFolder(row.id)}
                                  style={{ padding: '4px 8px', borderRadius: '6px', minWidth: 'unset', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>

                            {/* Folder Children (If expanded) */}
                            {isExpanded && (
                              members.length === 0 ? (
                                <tr>
                                  <td colSpan={7} style={{ padding: '10px 8px 10px 36px', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <CornerDownRight size={14} color="var(--color-text-muted)" />
                                      <span>Thư mục trống. Hãy chỉnh sửa tài liệu và chọn thư mục này để gom nhóm.</span>
                                    </div>
                                  </td>
                                </tr>
                              ) : (
                                members.map((member: AIDoc) => {
                                  const isTraining = trainingDocs[member.id] || member.status === 'processing';
                                  return (
                                    <tr 
                                      key={member.id} 
                                      onClick={() => handleEditDoc(member)}
                                      style={{ borderBottom: '1px solid var(--color-border-light)', cursor: 'pointer' }}
                                    >
                                      <td style={{ padding: '10px 8px 10px 36px', fontWeight: 600, color: 'var(--color-text)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                          <CornerDownRight size={14} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
                                          {(member.source_type === 'upload' || member.source_type === 'file') && <FileText size={16} color="#64748b" />}
                                          {member.source_type === 'manual' && <FileText size={16} color="#64748b" />}
                                          {member.source_type === 'web' && <Globe size={16} color="#64748b" />}
                                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: '240px' }} title={member.name}>
                                            {member.name}
                                          </span>
                                        </div>
                                      </td>
                                      <td style={{ padding: '10px 8px' }}>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                          {(member.source_type === 'upload' || member.source_type === 'file') ? 'File tải lên' : member.source_type === 'manual' ? 'Nhập tay' : 'Website'}
                                        </span>
                                      </td>
                                      <td style={{ padding: '10px 8px', color: 'var(--color-text-muted)' }}>
                                        {member.tags ? member.tags.split(',').map((t, idx) => (
                                          <span key={idx} style={{ background: 'var(--color-bg)', padding: '2px 6px', borderRadius: '4px', marginRight: '4px', fontSize: '0.6875rem', border: '1px solid var(--color-border)' }}>
                                            #{t.trim()}
                                          </span>
                                        )) : '—'}
                                      </td>
                                      <td style={{ padding: '10px 8px' }}>
                                        <span className="badge" style={{
                                          background: (trainingProgress[member.id] || member.status === 'processing') ? 'rgba(59, 130, 246, 0.08)' : member.status === 'trained' ? 'rgba(16, 185, 129, 0.08)' : member.status === 'error' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(107, 114, 128, 0.08)',
                                          color: (trainingProgress[member.id] || member.status === 'processing') ? '#3b82f6' : member.status === 'trained' ? '#10b981' : member.status === 'error' ? '#ef4444' : '#6b7280',
                                          fontSize: '0.75rem',
                                          fontWeight: 700
                                        }}>
                                          {trainingProgress[member.id] ? trainingProgress[member.id] : (member.status === 'trained' ? 'Đã học' : member.status === 'processing' ? 'Đang tạo vector...' : member.status === 'error' ? 'Lỗi RAG' : 'Chờ học')}
                                        </span>
                                      </td>
                                      <td style={{ padding: '10px 8px', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                                        {formatDocDate(member.updated_at)}
                                      </td>
                                      <td style={{ padding: '10px 8px' }} onClick={e => e.stopPropagation()}>
                                        <ToggleSwitch 
                                          active={Number(member.is_active) === 1} 
                                          onChange={() => handleToggleDoc(member.id, Number(member.is_active) || 0)} 
                                          disabled={member.status !== 'trained'}
                                        />
                                      </td>
                                      <td style={{ padding: '10px 8px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                                          <button 
                                            type="button"
                                            className="btn primary sm" 
                                            disabled={isTraining}
                                            onClick={() => handleTrainDoc(member.id)}
                                            style={{ padding: '4px 8px', borderRadius: '6px', minWidth: 'unset', display: 'flex', gap: 4, alignItems: 'center' }}
                                            title="Huấn luyện vector"
                                          >
                                            {isTraining ? <RefreshCw size={12} className="spin" /> : <Play size={12} fill="white" />}
                                            Train
                                          </button>
                                          <button 
                                            type="button"
                                            className="btn outline sm" 
                                            onClick={() => handleEditDoc(member)}
                                            style={{ padding: '4px 8px', borderRadius: '6px', minWidth: 'unset' }}
                                          >
                                            <Edit2 size={12} />
                                          </button>
                                          <button 
                                            type="button"
                                            className="btn outline sm text-danger" 
                                            onClick={() => handleDeleteDoc(member.id)}
                                            style={{ padding: '4px 8px', borderRadius: '6px', minWidth: 'unset', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })
                              )
                            )}
                          </React.Fragment>
                        );
                      }

                      // Root Document Row
                      const isTraining = trainingDocs[row.id] || row.status === 'processing';
                      return (
                        <tr 
                          key={row.id} 
                          onClick={() => handleEditDoc(row)}
                          style={{ borderBottom: '1px solid var(--color-border-light)', cursor: 'pointer' }}
                        >
                          <td style={{ padding: '12px 8px', fontWeight: 700, color: 'var(--color-text)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {(row.source_type === 'upload' || row.source_type === 'file') && <FileText size={16} color="#64748b" />}
                              {row.source_type === 'manual' && <FileText size={16} color="#64748b" />}
                              {row.source_type === 'web' && <Globe size={16} color="#64748b" />}
                              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: '300px' }} title={row.name}>
                                {row.name}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <span className="badge" style={{
                              background: (row.source_type === 'upload' || row.source_type === 'file') ? 'rgba(59, 130, 246, 0.08)' : row.source_type === 'manual' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                              color: (row.source_type === 'upload' || row.source_type === 'file') ? '#3b82f6' : row.source_type === 'manual' ? '#10b981' : '#f59e0b',
                              fontSize: '0.75rem',
                              fontWeight: 700
                            }}>
                              {(row.source_type === 'upload' || row.source_type === 'file') ? 'File tải lên' : row.source_type === 'manual' ? 'Nhập tay' : 'Website'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 8px', color: 'var(--color-text-muted)' }}>
                            {row.tags ? row.tags.split(',').map((t, idx) => (
                              <span key={idx} style={{ background: 'var(--color-bg)', padding: '2px 6px', borderRadius: '4px', marginRight: '4px', fontSize: '0.6875rem', border: '1px solid var(--color-border)' }}>
                                #{t.trim()}
                              </span>
                            )) : '—'}
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <span className="badge" style={{
                              background: (trainingProgress[row.id] || row.status === 'processing') ? 'rgba(59, 130, 246, 0.08)' : row.status === 'trained' ? 'rgba(16, 185, 129, 0.08)' : row.status === 'error' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(107, 114, 128, 0.08)',
                              color: (trainingProgress[row.id] || row.status === 'processing') ? '#3b82f6' : row.status === 'trained' ? '#10b981' : row.status === 'error' ? '#ef4444' : '#6b7280',
                              fontSize: '0.75rem',
                              fontWeight: 700
                            }}>
                              {trainingProgress[row.id] ? trainingProgress[row.id] : (row.status === 'trained' ? 'Đã học' : row.status === 'processing' ? 'Đang tạo vector...' : row.status === 'error' ? 'Lỗi RAG' : 'Chờ học')}
                            </span>
                          </td>
                          <td style={{ padding: '12px 8px', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                            {formatDocDate(row.updated_at)}
                          </td>
                          <td style={{ padding: '12px 8px' }} onClick={e => e.stopPropagation()}>
                            <ToggleSwitch 
                              active={Number(row.is_active) === 1} 
                              onChange={() => handleToggleDoc(row.id, Number(row.is_active) || 0)} 
                              disabled={row.status !== 'trained'}
                            />
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button 
                                type="button"
                                className="btn primary sm" 
                                disabled={isTraining}
                                onClick={() => handleTrainDoc(row.id)}
                                style={{ padding: '4px 8px', borderRadius: '6px', minWidth: 'unset', display: 'flex', gap: 4, alignItems: 'center' }}
                                title="Chạy huấn luyện vector"
                              >
                                {isTraining ? <RefreshCw size={12} className="spin" /> : <Play size={12} fill="white" />}
                                Train
                              </button>
                              <button 
                                type="button"
                                className="btn outline sm" 
                                onClick={() => handleEditDoc(row)}
                                style={{ padding: '4px 8px', borderRadius: '6px', minWidth: 'unset' }}
                              >
                                <Edit2 size={12} />
                              </button>
                              <button 
                                type="button"
                                className="btn outline sm text-danger" 
                                onClick={() => handleDeleteDoc(row.id)}
                                style={{ padding: '4px 8px', borderRadius: '6px', minWidth: 'unset', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: THÔNG SỐ RAG & CẤU HÌNH */}
      {subtab === 'rag' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Top Row: System instruction (Left - Wider) & General info (Right - Smaller) */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'stretch' }}>
            
            {/* Card 1: Chỉ dẫn Hệ thống & Vai trò AI (Left - Wider) */}
            <div className="card" style={{ flex: '1.6 1 450px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid var(--color-border-light)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--color-border-light)', paddingBottom: '0.75rem' }}>
                <div style={{ background: '#a855f7', color: '#ffffff', padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={16} />
                </div>
                Chỉ dẫn Hệ thống & Vai trò AI
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-light)' }}>System Instruction / Persona Prompt</label>
                  <span style={{ fontSize: '0.6875rem', background: 'rgba(189, 29, 45, 0.08)', color: '#BD1D2D', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>Bắt buộc</span>
                </div>
                <div 
                  className="resizable-textarea-wrapper form-input" 
                  style={{ 
                    height: '320px', 
                    minHeight: '260px', 
                    width: '100%', 
                    padding: '0.75rem 1rem', 
                    background: 'white',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <textarea
                    className="document-editor-textarea"
                    rows={12}
                    value={settings.persona_prompt}
                    onChange={e => setSettings({ ...settings, persona_prompt: e.target.value })}
                    placeholder="VD: Bạn là trợ lý AI chuyên nghiệp của Richland..."
                    style={{ fontSize: '0.8125rem', lineHeight: 1.5 }}
                  />
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  Định nghĩa hành vi, xưng hô, phạm vi trả lời của AI. Tránh để AI tự ý trả lời các thông tin ngoài tri thức đã được huấn luyện.
                </span>
              </div>

              <div style={{ background: 'rgba(59, 130, 246, 0.04)', border: '1px solid rgba(59, 130, 246, 0.12)', padding: '0.75rem', borderRadius: '8px', display: 'flex', gap: 8 }}>
                <Info size={14} color="#3b82f6" style={{ flexShrink: 0, marginTop: '2px' }} />
                <p style={{ fontSize: '0.725rem', color: '#1d4ed8', margin: 0, lineHeight: 1.4 }}>
                  Mẹo: Hãy chỉ dẫn AI xưng hô "Richland xin chào..." hoặc "Dạ, em là trợ lý Richland..." để tạo thiện cảm tốt nhất cho khách hàng bất động sản.
                </p>
              </div>
            </div>

            {/* Card 2: Cấu hình Chatbot & Thương hiệu (Right - Smaller) */}
            <div className="card" style={{ flex: '1 1 300px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid var(--color-border-light)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--color-border-light)', paddingBottom: '0.75rem' }}>
                <div style={{ background: '#3b82f6', color: '#ffffff', padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Settings size={16} />
                </div>
                Diện mạo & Nhãn hiệu AI (Nội bộ)
              </h3>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-light)' }}>Trạng thái hoạt động</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{settings.is_enabled ? 'Đang kích hoạt' : 'Tạm dừng'}</span>
                  <ToggleSwitch active={settings.is_enabled === 1} onChange={() => setSettings({ ...settings, is_enabled: settings.is_enabled === 1 ? 0 : 1 })} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-light)' }}>Tên trợ lý ảo (Bot Name)</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.bot_name}
                  onChange={e => setSettings({ ...settings, bot_name: e.target.value })}
                  placeholder="VD: AI Richland"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-light)' }}>Lời chào mặc định (Welcome Message)</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.welcome_msg}
                  onChange={e => setSettings({ ...settings, welcome_msg: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-light)' }}>Màu sắc thương hiệu (Brand Color)</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.brand_color}
                    onChange={e => setSettings({ ...settings, brand_color: e.target.value })}
                    style={{ flex: 1 }}
                  />
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: settings.brand_color, border: '1px solid var(--color-border)', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}></div>
                </div>
              </div>
            </div>

          </div>

          {/* Bottom Card: Tham số RAG & LLM Chuyên sâu (Spanning full width) */}
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', border: '1px solid var(--color-border-light)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--color-border-light)', paddingBottom: '0.75rem' }}>
              <div style={{ background: '#f97316', color: '#ffffff', padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SlidersHorizontal size={16} />
              </div>
              Tham số RAG & LLM Chuyên sâu
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2.5rem' }}>
              
              {/* Column 1: LLM Parameters */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: 0, color: 'var(--color-text)', borderBottom: '1px dashed var(--color-border-light)', paddingBottom: '4px' }}>
                  Cấu hình mô hình Generative AI (LLM)
                </h4>

                <RAGSlider
                  label="Độ sáng tạo (Temperature)"
                  value={settings.temperature}
                  min={0.0}
                  max={1.0}
                  step={0.1}
                  unit=""
                  description="Giá trị thấp (e.g. 0.2) giúp câu trả lời cực kỳ chính xác theo tri thức đã nạp."
                  onChange={val => setSettings({ ...settings, temperature: val })}
                />
                <RAGSlider
                  label="Độ dài tối đa (Max Tokens)"
                  value={settings.max_output_tokens}
                  min={256}
                  max={16384}
                  step={256}
                  unit=" tokens"
                  onChange={val => setSettings({ ...settings, max_output_tokens: val })}
                />

                <RAGSlider
                  label="Ghi nhớ lượt chat (History Limit)"
                  value={settings.history_limit}
                  min={2}
                  max={20}
                  step={1}
                  unit=" câu"
                  onChange={val => setSettings({ ...settings, history_limit: val })}
                />
              </div>

              {/* Column 2: RAG Parameters */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: 0, color: 'var(--color-text)', borderBottom: '1px dashed var(--color-border-light)', paddingBottom: '4px' }}>
                  Cấu hình truy xuất tri thức (RAG)
                </h4>

                <RAGSlider
                  label="Ngưỡng tương đồng Cosine (Similarity Threshold)"
                  value={settings.similarity_threshold}
                  min={0.25}
                  max={0.85}
                  step={0.05}
                  unit=""
                  onChange={val => setSettings({ ...settings, similarity_threshold: val })}
                />

                <RAGSlider
                  label="Số đoạn tri thức tối đa (Top-K Chunks)"
                  value={settings.top_k}
                  min={3}
                  max={15}
                  step={1}
                  unit=" đoạn"
                  onChange={val => setSettings({ ...settings, top_k: val })}
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '4px' }}>
                  <RAGSlider
                    label="Kích thước mảnh (Chunk Size)"
                    value={settings.chunk_size}
                    min={400}
                    max={1500}
                    step={50}
                    unit=" ký tự"
                    onChange={val => setSettings({ ...settings, chunk_size: val })}
                  />
                  <RAGSlider
                    label="Gối đầu (Chunk Overlap)"
                    value={settings.chunk_overlap}
                    min={50}
                    max={300}
                    step={10}
                    unit=" ký tự"
                    onChange={val => setSettings({ ...settings, chunk_overlap: val })}
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Action Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--color-border-light)', paddingTop: '1.25rem' }}>
            <button 
              type="button"
              className="btn primary" 
              onClick={handleSaveSettings}
              disabled={savingSettings}
              style={{ display: 'flex', gap: 6, alignItems: 'center', background: '#BD1D2D', borderColor: '#BD1D2D', padding: '10px 24px' }}>
              {savingSettings ? <RefreshCw size={14} className="spin" /> : null}
              Lưu cấu hình hệ thống
            </button>
          </div>
        </div>
      )}

      {/* Tab Content: LIVE SANDBOX CHAT */}
      {subtab === 'sandbox' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', height: '620px', alignItems: 'stretch' }}>
          {/* Chat Pane */}
          <div className="card" style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', border: '1px solid var(--color-border-light)' }}>
            {/* Header */}
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-bg-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ background: 'rgba(189, 29, 45, 0.08)', color: '#BD1D2D', padding: 8, borderRadius: '50%' }}>
                  <Bot size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {settings.bot_name}
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></div>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Hệ thống kiểm thử tri thức</span>
                </div>
              </div>
              <button 
                type="button"
                className="btn outline sm"
                onClick={() => setSandboxMessages([{ id: '1', sender: 'bot', text: 'Chào anh/chị! Đây là Sandbox để thử nghiệm tri thức AI. Nhập câu hỏi bên dưới để xem AI trả lời thế nào sau khi được huấn luyện.', timestamp: new Date() }])}
                style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '8px' }}
              >
                Xóa lịch sử
              </button>
            </div>

            {/* Message Body */}
            <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', background: '#f8fafc' }}>
              {sandboxMessages.map(msg => {
                const isBot = msg.sender === 'bot';
                return (
                  <div key={msg.id} style={{
                    display: 'flex',
                    justifyContent: isBot ? 'flex-start' : 'flex-end',
                    width: '100%',
                    gap: 10
                  }}>
                    {isBot && (
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#BD1D2D', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 4px rgba(189,29,45,0.15)' }}>
                        <Bot size={16} />
                      </div>
                    )}
                    <div style={{
                      maxWidth: '75%',
                      background: isBot ? 'white' : 'linear-gradient(135deg, #BD1D2D 0%, #8b101b 100%)',
                      color: isBot ? 'var(--color-text)' : 'white',
                      padding: '12px 16px',
                      borderRadius: isBot ? '4px 16px 16px 16px' : '16px 16px 4px 16px',
                      border: isBot ? '1px solid #e2e8f0' : 'none',
                      fontSize: '0.8125rem',
                      lineHeight: 1.55,
                      whiteSpace: 'pre-wrap',
                      boxShadow: isBot ? '0 1px 3px rgba(0,0,0,0.05)' : '0 2px 6px rgba(189,29,45,0.15)'
                    }}>
                      {msg.text}
                    </div>
                    {!isBot && (
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#64748b', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <User size={16} />
                      </div>
                    )}
                  </div>
                );
              })}
              {sandboxLoading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#BD1D2D', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Bot size={16} />
                  </div>
                  <div style={{
                    background: 'white',
                    color: 'var(--color-text-muted)',
                    padding: '12px 16px',
                    borderRadius: '4px 16px 16px 16px',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.8125rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <RefreshCw size={12} className="spin" />
                    AI đang phân tích & đối chiếu tri thức...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Footer */}
            <div style={{ padding: '1.25rem', borderTop: '1px solid var(--color-border-light)', display: 'flex', gap: '0.75rem', background: 'white' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Hỏi AI về pháp lý, mặt bằng, bảng giá..."
                value={sandboxInput}
                onChange={e => setSandboxInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSendSandbox(); }}
                disabled={sandboxLoading}
                style={{ flex: 1, height: '42px', borderRadius: '10px' }}
              />
              <button 
                type="button"
                className="btn primary" 
                onClick={handleSendSandbox}
                disabled={sandboxLoading || !sandboxInput.trim()}
                style={{ minWidth: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#BD1D2D', borderColor: '#BD1D2D', borderRadius: '10px' }}
              >
                <Send size={16} />
              </button>
            </div>
          </div>

          {/* Sandbox Context Settings Sidebar */}
          <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid var(--color-border-light)' }}>
            <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--color-border-light)', paddingBottom: '0.5rem', color: 'var(--color-text)' }}>
              <div style={{ background: 'rgba(189, 29, 45, 0.08)', color: '#BD1D2D', padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SlidersHorizontal size={14} />
              </div>
              Ngữ cảnh thử nghiệm
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
              Chọn bộ dữ liệu cụ thể của dự án/chiến dịch Richland để "ép" AI trả lời dựa trên tệp tài liệu tương ứng.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)' }}>
                Bối cảnh dự án & chiến dịch
              </label>
              <div 
                onClick={() => { setContextSearchQuery(''); setShowContextModal(true); }}
                style={{
                  padding: '10px 12px',
                  border: '1px solid var(--color-border)',
                  borderRadius: '10px',
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontWeight: 600
                }}
              >
                <span style={{ color: selectedProjectContext ? 'var(--color-text)' : 'var(--color-text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '220px' }}>
                  {selectedContextLabel}
                </span>
                <ChevronDown size={14} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
              </div>
            </div>

            <div style={{ background: 'rgba(59, 130, 246, 0.04)', border: '1px solid rgba(59, 130, 246, 0.12)', padding: '0.75rem', borderRadius: '8px', display: 'flex', gap: 8, marginTop: 'auto' }}>
              <Info size={14} color="#3b82f6" style={{ flexShrink: 0, marginTop: '2px' }} />
              <p style={{ fontSize: '0.6875rem', color: '#1d4ed8', margin: 0, lineHeight: 1.4 }}>
                Khi chat trong Sandbox, hệ thống sẽ gọi trực tiếp mô hình Gemini và chạy bộ đối chiếu tương đồng Cosine trên CSDL thật của bạn để kiểm thử.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SELECT MODAL: CHỌN DỰ ÁN HOẶC CHIẾN DỊCH */}
      {showContextModal && typeof document !== 'undefined' && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9999999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '460px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', margin: '1rem', maxHeight: '80vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Database size={16} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)' }}>Chọn bối cảnh tri thức</h3>
              </div>
              <button type="button" onClick={() => setShowContextModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            {/* Tabs for Projects vs Campaigns */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '2px', gap: '1rem' }}>
              <button
                type="button"
                onClick={() => { setContextTab('project'); setContextSearchQuery(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '6px 8px',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: contextTab === 'project' ? '#BD1D2D' : 'var(--color-text-muted)',
                  borderBottom: contextTab === 'project' ? '2px solid #BD1D2D' : '2px solid transparent'
                }}
              >
                Dự án BĐS
              </button>
              <button
                type="button"
                onClick={() => { setContextTab('campaign'); setContextSearchQuery(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '6px 8px',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: contextTab === 'campaign' ? '#BD1D2D' : 'var(--color-text-muted)',
                  borderBottom: contextTab === 'campaign' ? '2px solid #BD1D2D' : '2px solid transparent'
                }}
              >
                Chiến dịch Marketing
              </button>
            </div>

            {/* Search Input */}
            <input
              type="text"
              className="form-input"
              placeholder={`Tìm kiếm ${contextTab === 'project' ? 'dự án' : 'chiến dịch'}...`}
              value={contextSearchQuery}
              onChange={e => setContextSearchQuery(e.target.value)}
              style={{ fontSize: '0.8125rem', padding: '8px 12px', height: '36px' }}
              autoFocus
            />

            {/* List area */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', minHeight: '200px', maxHeight: '350px', paddingRight: '4px' }}>
              {/* Option: Clear Context */}
              <div
                onClick={() => {
                  setSelectedProjectContext('');
                  setSelectedContextLabel('Không kèm ngữ cảnh (Chat chung)');
                  setShowContextModal(false);
                }}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  background: selectedProjectContext === '' ? 'rgba(189, 29, 45, 0.05)' : 'transparent',
                  border: selectedProjectContext === '' ? '1px solid rgba(189, 29, 45, 0.15)' : '1px solid #e2e8f0',
                  color: selectedProjectContext === '' ? '#BD1D2D' : 'var(--color-text-muted)',
                  fontWeight: selectedProjectContext === '' ? 700 : 500,
                  textAlign: 'center',
                  marginBottom: '6px'
                }}
              >
                -- Không kèm ngữ cảnh (Chat chung) --
              </div>

              {contextTab === 'project' ? (
                projectsList.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>Không có dự án nào</div>
                ) : (
                  projectsList
                    .filter(p => p.name.toLowerCase().includes(contextSearchQuery.toLowerCase()))
                    .map(p => {
                      const ctxValue = `TÊN DỰ ÁN: ${p.name}\nQUY MÔ: ${p.scale_unit_count || 'Chưa cập nhật'} căn hộ\nVỊ TRÍ: ${p.location || 'Chưa rõ'}\nCHỦ ĐẦU TƯ: ${p.developer || 'Richland'}`;
                      const isSelected = selectedProjectContext === ctxValue;

                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedProjectContext(ctxValue);
                            setSelectedContextLabel(`Dự án: ${p.name}`);
                            setShowContextModal(false);
                          }}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.8125rem',
                            background: isSelected ? 'rgba(189, 29, 45, 0.05)' : 'white',
                            border: isSelected ? '1px solid rgba(189, 29, 45, 0.15)' : '1px solid #e2e8f0',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                            transition: 'all 0.15s'
                          }}
                          className="context-item"
                        >
                          <span style={{ fontWeight: 700, color: isSelected ? '#BD1D2D' : 'var(--color-text)' }}>{p.name}</span>
                          <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)' }}>
                            Vị trí: {p.location || 'Chưa rõ'} | CĐT: {p.developer || 'Richland'}
                          </span>
                        </div>
                      );
                    })
                )
              ) : (
                campaignsList.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>Không có chiến dịch nào</div>
                ) : (
                  campaignsList
                    .filter(c => c.name.toLowerCase().includes(contextSearchQuery.toLowerCase()))
                    .map(c => {
                      const ctxValue = `CHIẾN DỊCH: ${c.name}\nMÃ: ${c.code || '—'}`;
                      const isSelected = selectedProjectContext === ctxValue;

                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedProjectContext(ctxValue);
                            setSelectedContextLabel(`Chiến dịch: ${c.name}`);
                            setShowContextModal(false);
                          }}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.8125rem',
                            background: isSelected ? 'rgba(189, 29, 45, 0.05)' : 'white',
                            border: isSelected ? '1px solid rgba(189, 29, 45, 0.15)' : '1px solid #e2e8f0',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                            transition: 'all 0.15s'
                          }}
                          className="context-item"
                        >
                          <span style={{ fontWeight: 700, color: isSelected ? '#BD1D2D' : 'var(--color-text)' }}>{c.name}</span>
                          <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)' }}>
                            Mã: {c.code || '—'}
                          </span>
                        </div>
                      );
                    })
                )
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="button" className="btn outline sm" onClick={() => setShowContextModal(false)}>Đóng</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 0: TẢI TÀI LIỆU LÊN */}
      {showUploadModal && typeof document !== 'undefined' && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9999999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', margin: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>Tải tài liệu tri thức lên AI</h3>
              <button type="button" onClick={() => setShowUploadModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 700 }}>Chọn thư mục lưu trữ (Tùy chọn)</label>
              <CustomSelect 
                options={[
                  { value: '', label: '-- Thư mục gốc (Root) --' },
                  ...folderOptions.map(f => ({ value: String(f.id), label: f.name }))
                ]}
                value={uploadFolderId}
                onChange={val => setUploadFolderId(val || '')}
                searchable={true}
                placeholder="Chọn thư mục..."
                width="100%"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', border: '2px dashed var(--color-border)', borderRadius: '12px', padding: '2rem', textAlign: 'center', background: 'var(--color-bg-light)', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
              <Upload size={32} color="var(--color-text-muted)" style={{ margin: '0 auto' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Click để chọn file từ máy tính</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Hỗ trợ PDF, Docx, TXT tối đa 25MB</span>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,.docx,.doc,.txt" style={{ display: 'none' }} />
            </div>

            {uploadingFile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--color-primary)', fontWeight: 700, justifyContent: 'center' }}>
                <RefreshCw size={14} className="spin" />
                Đang xử lý băm tài liệu thành vector chunks...
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button type="button" className="btn outline" onClick={() => setShowUploadModal(false)} disabled={uploadingFile}>Đóng</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 1: NHẬP HỒ SƠ THỦ CÔNG */}
      {showManualModal && typeof document !== 'undefined' && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', zIndex: 9999999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '1000px', height: '90vh', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', margin: '1rem', overflow: 'hidden', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255, 255, 255, 0.8)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(189, 29, 45, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={18} color="#BD1D2D" />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>Huấn luyện tri thức (Nhập tay)</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowManualModal(false)} 
                style={{ 
                  background: 'var(--color-bg-light)', 
                  border: 'none', 
                  cursor: 'pointer', 
                  color: 'var(--color-text-muted)',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; e.currentTarget.style.color = 'var(--color-text)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-bg-light)'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', flex: 1, minHeight: 0 }}>
              {/* Left Column: Metadata */}
              <div 
                style={{ 
                  flex: '0 0 320px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '1.25rem', 
                  background: 'var(--color-bg-light)', 
                  padding: '1.5rem', 
                  borderRadius: '16px', 
                  border: '1px solid var(--color-border-light)',
                  overflowY: 'auto', 
                  maxHeight: '100%' 
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>Tiêu đề khối tri thức</label>
                  <input type="text" className="form-input" placeholder="Ví dụ: Chính sách chiết khấu đợt 1" value={manualTitle} onChange={e => setManualTitle(e.target.value)} style={{ fontWeight: 600 }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>Lưu vào thư mục (Tùy chọn)</label>
                  <CustomSelect 
                    options={[
                      { value: '', label: '-- Lưu riêng lẻ ở thư mục gốc (Root) --' },
                      ...folderOptions.map(f => ({ value: String(f.id), label: f.name }))
                    ]}
                    value={manualFolderId}
                    onChange={val => setManualFolderId(val || '')}
                    searchable={true}
                    placeholder="Chọn thư mục..."
                    width="100%"
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>Tags phân loại (ngăn cách bằng dấu phẩy)</label>
                  <input type="text" className="form-input" placeholder="Ví dụ: chietkhau, diamondcity" value={manualTags} onChange={e => setManualTags(e.target.value)} />
                  <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', lineHeight: 1.3 }}>
                    AI sẽ tự động đọc hiểu và phân tích ngữ cảnh để lấy tài liệu này khi người dùng hỏi các nội dung liên quan.
                  </span>
                </div>
              </div>

              {/* Right Column: Main Content Editor */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', height: '100%' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>Nội dung tri thức</label>
                <div 
                  className="resizable-textarea-wrapper" 
                  style={{ 
                    flex: 1, 
                    height: '100%', 
                    background: '#fff', 
                    border: '1px solid var(--color-border)', 
                    borderRadius: '16px', 
                    padding: '1.25rem',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <textarea 
                    className="document-editor-textarea" 
                    placeholder="Nhập hoặc dán nội dung chi tiết để AI ghi nhớ..." 
                    value={manualContent} 
                    onChange={e => setManualContent(e.target.value)} 
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem' }}>
              <button type="button" className="btn outline" onClick={() => setShowManualModal(false)} style={{ borderRadius: '10px', height: '40px' }}>Hủy</button>
              <button type="button" className="btn primary" onClick={handleAddManual} disabled={submittingManual} style={{ borderRadius: '10px', height: '40px', background: '#BD1D2D', borderColor: '#BD1D2D' }}>
                {submittingManual ? <RefreshCw size={14} className="spin" /> : null}
                Lưu & Huấn luyện
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 2: CÀO WEBSITE */}
      {showWebModal && typeof document !== 'undefined' && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9999999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '600px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', margin: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>Cào dữ liệu từ Website</h3>
              <button type="button" onClick={() => setShowWebModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 700 }}>Tên website / Trang tham khảo</label>
              <input type="text" className="form-input" placeholder="Ví dụ: Trang chủ Diamond City" value={webTitle} onChange={e => setWebTitle(e.target.value)} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 700 }}>Đường dẫn URL chi tiết (AI sẽ tự động tải nội dung)</label>
              <input type="url" className="form-input" placeholder="Ví dụ: https://richland.com.vn/gioi-thieu" value={webUrl} onChange={e => setWebUrl(e.target.value)} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 700 }}>Lưu vào thư mục (Tùy chọn)</label>
              <CustomSelect 
                options={[
                  { value: '', label: '-- Lưu riêng lẻ ở thư mục gốc (Root) --' },
                  ...folderOptions.map(f => ({ value: String(f.id), label: f.name }))
                ]}
                value={webFolderId}
                onChange={val => setWebFolderId(val || '')}
                searchable={true}
                placeholder="Chọn thư mục..."
                width="100%"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 700 }}>Tags phân loại</label>
              <input type="text" className="form-input" placeholder="Ví dụ: website, landingpage, diamondcity" value={webTags} onChange={e => setWebTags(e.target.value)} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button type="button" className="btn outline" onClick={() => setShowWebModal(false)}>Hủy</button>
              <button type="button" className="btn primary" onClick={handleAddWeb} disabled={submittingWeb}>
                {submittingWeb ? <RefreshCw size={14} className="spin" /> : null}
                Bắt đầu cào & Học
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 3: TẠO THƯ MỤC */}
      {showFolderModal && typeof document !== 'undefined' && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9999999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', margin: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>Tạo Thư Mục Mới</h3>
              <button type="button" onClick={() => setShowFolderModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 700 }}>Tên thư mục</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Ví dụ: Dự án Grand Park" 
                value={folderName} 
                onChange={e => setFolderName(e.target.value)} 
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button type="button" className="btn outline" onClick={() => setShowFolderModal(false)}>Hủy</button>
              <button type="button" className="btn primary" onClick={handleCreateFolder} disabled={submittingFolder}>
                {submittingFolder ? <RefreshCw size={14} className="spin" /> : null}
                Tạo Thư Mục
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 4: CHỈNH SỬA TÀI LIỆU */}
      {showEditModal && editingDoc && typeof document !== 'undefined' && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', zIndex: 9999999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '1000px', height: '90vh', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', margin: '1rem', overflow: 'hidden', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255, 255, 255, 0.8)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(189, 29, 45, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={18} color="#BD1D2D" />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>Chỉnh sửa dữ liệu huấn luyện</h3>
              </div>
              <button 
                type="button" 
                onClick={() => { setShowEditModal(false); setEditingDoc(null); }} 
                style={{ 
                  background: 'var(--color-bg-light)', 
                  border: 'none', 
                  cursor: 'pointer', 
                  color: 'var(--color-text-muted)',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; e.currentTarget.style.color = 'var(--color-text)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-bg-light)'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', flex: 1, minHeight: 0 }}>
              {/* Left Column: Metadata */}
              <div 
                style={{ 
                  flex: '0 0 320px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '1.25rem', 
                  background: 'var(--color-bg-light)', 
                  padding: '1.5rem', 
                  borderRadius: '16px', 
                  border: '1px solid var(--color-border-light)',
                  overflowY: 'auto', 
                  maxHeight: '100%' 
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>Tiêu đề khối tri thức</label>
                  <input type="text" className="form-input" value={editingDoc.name} onChange={e => setEditingDoc({ ...editingDoc, name: e.target.value })} style={{ fontWeight: 600 }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>Tags phân loại</label>
                  <input type="text" className="form-input" value={editingDoc.tags || ''} onChange={e => setEditingDoc({ ...editingDoc, tags: e.target.value })} placeholder="Ví dụ: chietkhau, canho" />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>Di chuyển vào thư mục</label>
                  <CustomSelect 
                    options={[
                      { value: '', label: '-- Thư mục gốc (Root) --' },
                      ...folderOptions.map(f => ({ value: String(f.id), label: f.name }))
                    ]}
                    value={editingDoc.parent_id || ''}
                    onChange={val => setEditingDoc({ ...editingDoc, parent_id: val || '' })}
                    searchable={true}
                    placeholder="Di chuyển vào thư mục..."
                    width="100%"
                  />
                </div>

                {/* Audit Info Card */}
                <div style={{ 
                  marginTop: 'auto', 
                  padding: '1rem', 
                  background: 'white', 
                  border: '1px solid var(--color-border-light)', 
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  color: 'var(--color-text-muted)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '6px', marginBottom: '2px' }}>
                    <Database size={14} color="#BD1D2D" />
                    Thông tin lưu trữ
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Người tạo:</span>
                    <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{editingDoc.created_by || 'Hệ thống'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Ngày tạo:</span>
                    <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{formatDocDate(editingDoc.created_at)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Lần chỉnh sửa:</span>
                    <span style={{ fontWeight: 600, color: '#10b981', background: 'rgba(16, 185, 129, 0.08)', padding: '1px 6px', borderRadius: '4px' }}>
                      Lần {editingDoc.version || 1}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Main Content Editor */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', height: '100%' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>Nội dung chi tiết</label>
                <div 
                  className="resizable-textarea-wrapper" 
                  style={{ 
                    flex: 1, 
                    height: '100%', 
                    background: '#fff', 
                    border: '1px solid var(--color-border)', 
                    borderRadius: '16px', 
                    padding: '1.25rem',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <textarea 
                    className="document-editor-textarea" 
                    value={editingDoc.content || ''} 
                    onChange={e => setEditingDoc({ ...editingDoc, content: e.target.value })} 
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem' }}>
              <button type="button" className="btn outline" onClick={() => { setShowEditModal(false); setEditingDoc(null); }} style={{ borderRadius: '10px', height: '40px' }}>Hủy</button>
              <button type="button" className="btn primary" onClick={handleUpdateDoc} style={{ borderRadius: '10px', height: '40px', background: '#BD1D2D', borderColor: '#BD1D2D' }}>
                Cập nhật tri thức
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
