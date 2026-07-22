import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, RefreshCw, Upload, Edit3, Trash2, Check, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../../contexts/LanguageContext';
import toast from 'react-hot-toast';

interface SignaturePadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (signatureUrl: string) => Promise<void> | void;
  initialSignatureUrl?: string | null;
}

export const SignaturePadModal: React.FC<SignaturePadModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialSignatureUrl
}) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'draw' | 'upload'>('draw');
  const [strokeWidth, setStrokeWidth] = useState<number>(35); // stroke thickness
  const [penColor, setPenColor] = useState<string>('#0f172a'); // dark slate
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [uploadedImg, setUploadedImg] = useState<string | null>(initialSignatureUrl || null);
  const [isProcessingBg, setIsProcessingBg] = useState(false);
  const [saving, setSaving] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Auto remove white background from uploaded image
  const removeWhiteBackground = (imageSrc: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageSrc);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Loop through pixels and make white/near-white transparent
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // Threshold for near white background
          if (r > 215 && g > 215 && b > 215) {
            data[i + 3] = 0; // set alpha to 0
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(imageSrc);
      img.src = imageSrc;
    });
  };

  // Canvas drawing setup
  useEffect(() => {
    if (isOpen && activeTab === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = penColor;
        ctx.lineWidth = strokeWidth / 10;
      }
    }
  }, [isOpen, activeTab, penColor, strokeWidth]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasDrawn(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('Dung lượng file không được vượt quá 5MB'));
      return;
    }

    setIsProcessingBg(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const rawBase64 = event.target?.result as string;
      try {
        const transparentBase64 = await removeWhiteBackground(rawBase64);
        setUploadedImg(transparentBase64);
        toast.success(t('Đã tự động xử lý tách nền trắng ảnh chữ ký'));
      } catch (err) {
        setUploadedImg(rawBase64);
      } finally {
        setIsProcessingBg(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSignature = async () => {
    let finalSignatureUrl: string | null = null;

    if (activeTab === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawn) {
        toast.error(t('Vui lòng vẽ chữ ký trước khi lưu'));
        return;
      }
      finalSignatureUrl = canvas.toDataURL('image/png');
    } else {
      if (!uploadedImg) {
        toast.error(t('Vui lòng chọn file ảnh chữ ký trước khi lưu'));
        return;
      }
      finalSignatureUrl = uploadedImg;
    }

    setSaving(true);
    try {
      await onSave(finalSignatureUrl);
      toast.success(t('Đã lưu cấu hình chữ ký thành công'));
      onClose();
    } catch (err: any) {
      toast.error(t('Lỗi lưu chữ ký: ') + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(5px)',
        zIndex: 10000000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '680px',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text)' }}>
              {t('Thiết lập Chữ ký Mẫu Cá nhân')}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              {t('Chữ ký này sẽ được sử dụng để ký nhanh chứng từ và phiếu hợp tác.')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '6px',
              cursor: 'pointer',
              color: 'var(--color-text-muted)'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selection */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('draw')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'draw' ? 'rgba(189, 29, 45, 0.1)' : 'transparent',
              color: activeTab === 'draw' ? '#BD1D2D' : 'var(--color-text-muted)',
              fontWeight: activeTab === 'draw' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Edit3 size={15} />
            {t('Vẽ chữ ký tay')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'upload' ? 'rgba(189, 29, 45, 0.1)' : 'transparent',
              color: activeTab === 'upload' ? '#BD1D2D' : 'var(--color-text-muted)',
              fontWeight: activeTab === 'upload' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Upload size={15} />
            {t('Tải ảnh chữ ký (Tách nền)')}
          </button>
        </div>

        {/* Tab 1: Draw Canvas */}
        {activeTab === 'draw' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{
              border: '2px dashed var(--color-border)',
              borderRadius: '12px',
              background: 'white',
              position: 'relative',
              touchAction: 'none'
            }}>
              <canvas
                ref={canvasRef}
                width={630}
                height={220}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                style={{ width: '100%', height: '220px', cursor: 'crosshair', display: 'block', borderRadius: '10px' }}
              />
              {!hasDrawn && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94a3b8',
                  fontSize: '0.85rem'
                }}>
                  {t('Vẽ chữ ký của bạn vào khung này')}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t('Nét mực:')}</span>
                <input
                  type="range"
                  min={15}
                  max={60}
                  value={strokeWidth}
                  onChange={(e) => setStrokeWidth(Number(e.target.value))}
                  style={{ width: '80px', accentColor: '#BD1D2D' }}
                />
              </div>

              <button
                type="button"
                onClick={clearCanvas}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)',
                  fontSize: '0.75rem',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer'
                }}
              >
                <Trash2 size={13} />
                {t('Xóa vẽ lại')}
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Upload File */}
        {activeTab === 'upload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{
              border: '2px dashed var(--color-border)',
              borderRadius: '12px',
              padding: '24px',
              textAlign: 'center',
              background: 'var(--color-bg)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px'
            }}>
              {uploadedImg ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '100%' }}>
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px',
                    width: '100%',
                    maxHeight: '140px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                    backgroundSize: '12px 12px'
                  }}>
                    <img src={uploadedImg} alt="Xem trước chữ ký" style={{ maxHeight: '110px', objectFit: 'contain' }} />
                  </div>
                  <label style={{
                    fontSize: '0.75rem',
                    color: '#BD1D2D',
                    cursor: 'pointer',
                    fontWeight: 600,
                    textDecoration: 'underline'
                  }}>
                    {t('Chọn ảnh khác')}
                    <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
                  </label>
                </div>
              ) : (
                <label style={{ cursor: 'pointer', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <Upload size={32} style={{ color: '#BD1D2D' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>
                    {t('Bấm để chọn ảnh chữ ký (.png, .jpg)')}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    {t('Hệ thống sẽ tự động quét tách nền trắng thành ảnh nét mực trong suốt')}
                  </span>
                  <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>
              )}
              {isProcessingBg && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-primary)' }}>
                  <RefreshCw size={14} className="spin" />
                  {t('Đang tự động quét và tách nền trắng...')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-text)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {t('Hủy')}
          </button>
          <button
            type="button"
            onClick={handleSaveSignature}
            disabled={saving || (activeTab === 'draw' && !hasDrawn) || (activeTab === 'upload' && !uploadedImg)}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              background: '#BD1D2D',
              color: 'white',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              opacity: (activeTab === 'draw' && !hasDrawn) || (activeTab === 'upload' && !uploadedImg) ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {saving ? <RefreshCw size={14} className="spin" /> : <Check size={16} />}
            {t('Lưu chữ ký mẫu')}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};
