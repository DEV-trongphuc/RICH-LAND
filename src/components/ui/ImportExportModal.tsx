import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Download, FileText, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { CustomRadio } from './CustomRadio';
import api from '../../api/axios';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityName: string; // "Liên hệ", "Công ty"
  onImport?: (data: any[]) => void;
  onExport?: (format: 'csv'|'excel') => void;
}

import { useUploadProgress } from '../../contexts/UploadProgressContext';

export const ImportExportModal: React.FC<ImportExportModalProps> = ({ isOpen, onClose, entityName, onImport, onExport }) => {
  const { addToast } = useUIStore();
  const { startUpload, updateProgress, finishUpload } = useUploadProgress();
  const [tab, setTab] = useState<'import' | 'export'>('import');
  
  // Mapping entity names to backend types
  const typeMap: Record<string, string> = {
    'Liên hệ': 'contact',
    'Công ty': 'company',
    'Cơ hội': 'deal',
    'Sản phẩm': 'product',
    'Kho hàng': 'inventory'
  };
  const type = typeMap[entityName] || 'contact';

  // Import states
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [step, setStep] = useState<1 | 2>(1); // 1: Upload, 2: Result

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    
    setImporting(true);
    const sizeStr = (f.size / (1024 * 1024)).toFixed(2) + ' MB';
    const taskId = startUpload(f.name, sizeStr);

    const formData = new FormData();
    formData.append('file', f);
    formData.append('type', type);

    try {
      updateProgress(taskId, 20, 'uploading');
      const res = await api.post('/import/process', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            updateProgress(taskId, percent, percent === 100 ? 'processing' : 'uploading');
          }
        }
      });
      finishUpload(taskId, true);
      setResults(res.data.data);
      setStep(2);
      addToast('Xử lý file hoàn tất', 'success');
    } catch (err: any) {
      finishUpload(taskId, false, err.response?.data?.message || 'Lỗi khi import file');
      addToast(err.response?.data?.message || 'Lỗi khi import file', 'error');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleDownloadTemplate = () => {
    window.open(`${api.defaults.baseURL}/import/template?type=${type}&token=${localStorage.getItem('token')}`, '_blank');
    addToast('Đang tải file mẫu...', 'success');
  };

  return typeof document !== 'undefined' ? createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="overlay-backdrop" style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
          <motion.div 
          style={{ width: '100%', maxWidth: 600, background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', boxShadow: 'var(--shadow-2xl)', position: 'relative' }}
          initial={{ opacity: 0, y: 20, scale: 0.95 }} 
          animate={{ opacity: 1, y: 0, scale: 1 }} 
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)' }}>
            <button 
              style={{ flex: 1, padding: '1.25rem', background: tab === 'import' ? 'var(--color-bg)' : 'transparent', borderBottom: tab === 'import' ? '2px solid var(--color-primary)' : '2px solid transparent', fontWeight: 600, color: tab === 'import' ? 'var(--color-primary)' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', border: 'none', cursor: 'pointer' }}
              onClick={() => { setTab('import'); setStep(1); setFile(null); setResults(null); }}
            >
              <Upload size={18} /> Nhập (Import)
            </button>
            <button 
              style={{ flex: 1, padding: '1.25rem', background: tab === 'export' ? 'var(--color-bg)' : 'transparent', borderBottom: tab === 'export' ? '2px solid var(--color-primary)' : '2px solid transparent', fontWeight: 600, color: tab === 'export' ? 'var(--color-primary)' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', border: 'none', cursor: 'pointer' }}
              onClick={() => setTab('export')}
            >
              <Download size={18} /> Xuất (Export)
            </button>
            <button className="btn-icon-bare" style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 10 }} onClick={onClose}><X size={20}/></button>
          </div>
          
          {tab === 'import' && (
            <div style={{ padding: '1.5rem' }}>
              {step === 1 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Nhập {entityName} từ file</h3>
                      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Hỗ trợ định dạng .csv. Hệ thống sẽ tự động thêm các trường tùy chỉnh vào file mẫu.</p>
                    </div>
                    <button className="btn outline sm" onClick={handleDownloadTemplate}><FileText size={14}/> Tải file mẫu</button>
                  </div>
                  
                  <div style={{ border: '2px dashed var(--color-primary-light)', borderRadius: 'var(--radius-xl)', padding: '3rem 2rem', textAlign: 'center', background: 'var(--color-bg)', cursor: importing ? 'not-allowed' : 'pointer', position: 'relative', transition: 'all 0.2s' }}>
                    <input type="file" accept=".csv" onChange={handleFileUpload} disabled={importing} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: importing ? 'not-allowed' : 'pointer' }} />
                    {importing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                        <RefreshCw size={40} className="animate-spin" color="var(--color-primary)" />
                        <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>Đang xử lý dữ liệu...</h4>
                      </div>
                    ) : (
                      <>
                        <Upload size={40} color="var(--color-primary)" style={{ margin: '0 auto 1rem', opacity: 0.8 }} />
                        <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Kéo thả file hoặc Click để tải lên</h4>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Định dạng CSV, tối đa 10MB</p>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                    <div style={{ width: 64, height: 64, background: 'var(--color-success-light)', color: 'var(--color-success)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                      <CheckCircle size={32} />
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>Kết quả Import</h3>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1rem' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-success)' }}>{results?.imported || 0}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Thành công</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: results?.errors ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>{results?.errors || 0}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Lỗi</div>
                      </div>
                    </div>
                  </div>

                  {results?.error_log && results.error_log.length > 0 && (
                    <div style={{ padding: '1rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', maxHeight: '150px', overflowY: 'auto' }}>
                      <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-danger)' }}>Chi tiết lỗi:</h4>
                      {results.error_log.map((err, i) => (
                        <p key={i} style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>• {err}</p>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', paddingTop: '1rem', borderTop: '1px solid var(--color-border-light)' }}>
                    <button className="btn outline" onClick={() => { setStep(1); setResults(null); }}>Nhập tiếp</button>
                    <button className="btn primary" onClick={onClose}>Hoàn tất</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'export' && (
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Xuất {entityName}</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Tải xuống dữ liệu hiện tại để sao lưu hoặc phân tích. File CSV hỗ trợ tốt cho Excel.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                <button 
                  style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1.5rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.background = 'var(--color-primary-light)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = 'var(--color-bg)'; }}
                  onClick={() => { if(onExport) onExport('csv'); onClose(); }}
                >
                  <div style={{ width: 48, height: 48, background: 'var(--color-surface)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}>
                    <FileText size={24} color="var(--color-primary)" />
                  </div>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '1rem', display: 'block' }}>Xuất file CSV (Khuyên dùng)</span>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Tải xuống toàn bộ danh sách kèm các trường tùy chỉnh</span>
                  </div>
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
      )}
    </AnimatePresence>,
    document.body
  ) : null;
};
