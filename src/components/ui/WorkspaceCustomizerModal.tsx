import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, UploadCloud, RotateCcw, Image as ImageIcon, LayoutGrid, Sparkles, Layers, Sliders } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { compressToWebP } from '../../utils/imageCompress';

export interface WorkspaceCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBg: string;
  currentCols: number;
  currentOverlay: number;
  onSave: (bg: string, cols: number, overlay: number) => void;
  userId?: number | string;
}

export const PRESET_WALLPAPERS = [
  {
    id: 'richland_brand',
    name: 'RICH LAND Luxury Dark Red (Độc quyền)',
    url: 'linear-gradient(135deg, #160608 0%, #2a0b10 40%, #110406 100%)',
    preview: 'linear-gradient(135deg, #160608 0%, #2a0b10 40%, #110406 100%)',
    tag: 'Tối giản'
  },
  {
    id: 'clean_light',
    name: 'Mặc định phẳng (Không ảnh nền)',
    url: '',
    preview: 'linear-gradient(135deg, rgba(200,200,200,0.2) 0%, rgba(150,150,150,0.1) 100%)',
    tag: 'Tối giản'
  },
  // Văn phòng & Không gian làm việc
  {
    id: 'modern_office',
    name: 'Văn phòng hiện đại',
    url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1920&q=80',
    preview: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=360&q=70',
    tag: 'Văn phòng'
  },
  {
    id: 'skyline_office',
    name: 'Tòa cao ốc Skyline',
    url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1920&q=80',
    preview: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=360&q=70',
    tag: 'Văn phòng'
  },
  {
    id: 'creative_studio',
    name: 'Creative Studio',
    url: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1920&q=80',
    preview: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=360&q=70',
    tag: 'Văn phòng'
  },
  {
    id: 'luxury_boardroom',
    name: 'Executive Boardroom',
    url: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1920&q=80',
    preview: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=360&q=70',
    tag: 'Văn phòng'
  },
  {
    id: 'warm_lamp_desk',
    name: 'Bàn làm việc đèn ấm',
    url: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=1920&q=80',
    preview: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=360&q=70',
    tag: 'Văn phòng'
  },
  {
    id: 'industrial_loft',
    name: 'Loft công nghiệp',
    url: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1920&q=80',
    preview: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=360&q=70',
    tag: 'Văn phòng'
  },

  // Phong cảnh & Thiên nhiên
  {
    id: 'sunset_beach',
    name: 'Hoàng hôn biển êm đềm',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=80',
    preview: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=360&q=70',
    tag: 'Thiên nhiên'
  },
  {
    id: 'swiss_alps',
    name: 'Dãy núi tuyết Alps',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=80',
    preview: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=360&q=70',
    tag: 'Thiên nhiên'
  },
  {
    id: 'mountain_lake',
    name: 'Hồ nước phẳng lặng mùa thu',
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1920&q=80',
    preview: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=360&q=70',
    tag: 'Thiên nhiên'
  },
  {
    id: 'kyoto_bamboo',
    name: 'Rừng tre sương mù Kyoto',
    url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1920&q=80',
    preview: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=360&q=70',
    tag: 'Thiên nhiên'
  },
  {
    id: 'cloud_pass',
    name: 'Cung đường đèo mây',
    url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1920&q=80',
    preview: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=360&q=70',
    tag: 'Thiên nhiên'
  },
  {
    id: 'forest_sunlight',
    name: 'Rừng thông ban mai',
    url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1920&q=80',
    preview: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=360&q=70',
    tag: 'Thiên nhiên'
  },

  // Trừu tượng & Vũ trụ
  {
    id: 'nebula_space',
    name: 'Dải Ngân hà Nebula',
    url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1920&q=80',
    preview: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=360&q=70',
    tag: 'Trừu tượng'
  },
  {
    id: 'silk_wave',
    name: 'Sóng lụa Gradient 3D',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1920&q=80',
    preview: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=360&q=70',
    tag: 'Trừu tượng'
  },
  {
    id: 'aurora_borealis',
    name: 'Cực quang Bắc cực',
    url: 'https://images.unsplash.com/photo-1579033461380-adb47c3eb938?auto=format&fit=crop&w=1920&q=80',
    preview: 'https://images.unsplash.com/photo-1579033461380-adb47c3eb938?auto=format&fit=crop&w=360&q=70',
    tag: 'Trừu tượng'
  },
  {
    id: 'particles_flow',
    name: 'Dòng chảy hạt phát sáng',
    url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1920&q=80',
    preview: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=360&q=70',
    tag: 'Trừu tượng'
  },
  {
    id: 'minimal_glass_geo',
    name: 'Khối kính Minimal 3D',
    url: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=1920&q=80',
    preview: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=360&q=70',
    tag: 'Trừu tượng'
  },

  // Tối giản & Nghệ thuật Pastel
  {
    id: 'scandinavian_arch',
    name: 'Kiến trúc Scandinavian',
    url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1920&q=80',
    preview: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=360&q=70',
    tag: 'Tối giản'
  },
  {
    id: 'desert_dunes',
    name: 'Đồi cát uốn lượn dưới nắng',
    url: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1920&q=80',
    preview: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=360&q=70',
    tag: 'Tối giản'
  },
  {
    id: 'window_shadows',
    name: 'Ánh sáng xuyên rèm cửa',
    url: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1920&q=80',
    preview: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=360&q=70',
    tag: 'Tối giản'
  },
  {
    id: 'marble_arch',
    name: 'Kiến trúc vòm cẩm thạch',
    url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1920&q=80',
    preview: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=360&q=70',
    tag: 'Tối giản'
  }
];

let hasPreloadedWorkspaceWallpapers = false;

export const preloadWorkspaceWallpapers = () => {
  if (typeof window === 'undefined' || hasPreloadedWorkspaceWallpapers) return;
  hasPreloadedWorkspaceWallpapers = true;

  const urls: string[] = [];
  PRESET_WALLPAPERS.forEach(item => {
    if (item.url && (item.url.startsWith('http') || item.url.startsWith('/'))) {
      urls.push(item.url);
    }
    if (item.preview && (item.preview.startsWith('http') || item.preview.startsWith('/'))) {
      urls.push(item.preview);
    }
  });

  const uniqueUrls = Array.from(new Set(urls));
  const preloadQueue = [...uniqueUrls];
  const CONCURRENCY = 4;

  const startWorker = () => {
    if (preloadQueue.length === 0) return;
    const url = preloadQueue.shift();
    if (!url) return;

    const img = new Image();
    try {
      (img as any).fetchPriority = 'high';
    } catch (_) {}
    img.onload = () => startWorker();
    img.onerror = () => startWorker();
    img.src = url;
  };

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => {
      for (let i = 0; i < CONCURRENCY; i++) {
        startWorker();
      }
    }, { timeout: 1000 });
  } else {
    setTimeout(() => {
      for (let i = 0; i < CONCURRENCY; i++) {
        startWorker();
      }
    }, 200);
  }
};

const PRESET_PATTERNS = [
  {
    id: 'gradient_indigo',
    name: 'Chàm Huyền Bí',
    url: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #1e293b 100%)',
    preview: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #1e293b 100%)'
  },
  {
    id: 'gradient_emerald',
    name: 'Xanh Ngọc Lục Bảo',
    url: 'linear-gradient(135deg, #064e3b 0%, #042f2e 50%, #0f172a 100%)',
    preview: 'linear-gradient(135deg, #064e3b 0%, #042f2e 50%, #0f172a 100%)'
  },
  {
    id: 'gradient_ruby',
    name: 'Đỏ Ruby Doanh Nghiệp',
    url: 'linear-gradient(135deg, #450a0a 0%, #7f1d1d 50%, #1c1917 100%)',
    preview: 'linear-gradient(135deg, #450a0a 0%, #7f1d1d 50%, #1c1917 100%)'
  },
  {
    id: 'gradient_sunset',
    name: 'Hoàng Hôn Ấm Áp',
    url: 'linear-gradient(135deg, #431407 0%, #7c2d12 50%, #1e293b 100%)',
    preview: 'linear-gradient(135deg, #431407 0%, #7c2d12 50%, #1e293b 100%)'
  },
  {
    id: 'pattern_mesh',
    name: 'Mesh Lưới Sáng',
    url: 'radial-gradient(at 100% 0%, #e0e7ff 0px, transparent 50%), radial-gradient(at 0% 100%, #fed7aa 0px, transparent 50%), linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
    preview: 'radial-gradient(at 100% 0%, #e0e7ff 0px, transparent 50%), radial-gradient(at 0% 100%, #fed7aa 0px, transparent 50%), linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
  },
  {
    id: 'pattern_dark_mesh',
    name: 'Mesh Bóng Tối',
    url: 'radial-gradient(at 100% 0%, #312e81 0px, transparent 50%), radial-gradient(at 0% 100%, #1e1b4b 0px, transparent 50%), linear-gradient(135deg, #090d16 0%, #0f172a 100%)',
    preview: 'radial-gradient(at 100% 0%, #312e81 0px, transparent 50%), radial-gradient(at 0% 100%, #1e1b4b 0px, transparent 50%), linear-gradient(135deg, #090d16 0%, #0f172a 100%)'
  }
];

export const WorkspaceCustomizerModal: React.FC<WorkspaceCustomizerModalProps> = ({
  isOpen,
  onClose,
  currentBg,
  currentCols,
  currentOverlay,
  onSave,
  userId
}) => {
  const [selectedBg, setSelectedBg] = useState<string>(currentBg || '');
  const [selectedCols, setSelectedCols] = useState<number>(currentCols || 4);
  const [selectedOverlay, setSelectedOverlay] = useState<number>(currentOverlay ?? 0);
  const [activeTab, setActiveTab] = useState<'wallpapers' | 'patterns' | 'custom'>('wallpapers');
  const [wallpaperTag, setWallpaperTag] = useState<string>('all');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedPreview, setUploadedPreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    preloadWorkspaceWallpapers();
  }, []);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn định dạng hình ảnh (PNG, JPG, WEBP)!');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      const { naturalWidth, naturalHeight } = img;
      URL.revokeObjectURL(objectUrl);

      if (naturalWidth < 1280 || naturalHeight < 720) {
        toast.error(
          `Ảnh có độ phân giải ${naturalWidth}x${naturalHeight}px, chưa đạt yêu cầu tối thiểu (1280x720px) để làm nền bàn làm việc. Vui lòng chọn ảnh sắc nét hơn!`,
          { duration: 5000 }
        );
        return;
      }

      setIsUploading(true);
      try {
        let fileToUpload = file;
        try {
          fileToUpload = await compressToWebP(file);
        } catch {
          fileToUpload = file;
        }

        const formData = new FormData();
        formData.append('file', fileToUpload);

        const res = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (res.data && res.data.success && res.data.file_url) {
          const uploadedUrl = res.data.file_url;
          setSelectedBg(uploadedUrl);
          setUploadedPreview(uploadedUrl);
          toast.success('Tải ảnh nền sắc nét thành công!');
        } else {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            setSelectedBg(dataUrl);
            setUploadedPreview(dataUrl);
            toast.success('Đã tải ảnh lên thành công!');
          };
          reader.readAsDataURL(fileToUpload);
        }
      } catch (err) {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          setSelectedBg(dataUrl);
          setUploadedPreview(dataUrl);
          toast.success('Đã chọn ảnh làm nền!');
        };
        reader.readAsDataURL(file);
      } finally {
        setIsUploading(false);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      toast.error('Không thể đọc dữ liệu file ảnh, vui lòng thử lại!');
    };

    img.src = objectUrl;
  };

  const handleApply = () => {
    onSave(selectedBg, selectedCols, selectedOverlay);
    toast.success('Đã lưu tùy biến Bàn làm việc của bạn!');
    onClose();
  };

  const handleReset = () => {
    setSelectedBg('/imgs/myerp_dark_brand_wallpaper.jpg');
    setSelectedCols(4);
    setSelectedOverlay(0);
    setUploadedPreview('');
    onSave('/imgs/myerp_dark_brand_wallpaper.jpg', 4, 0);
    toast.success('Đã đặt lại giao diện mặc định (4 cột & RICH LAND Brand)!');
    onClose();
  };

  return createPortal(
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(5px)',
        zIndex: 2147483640,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          backgroundColor: 'var(--color-surface)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--color-border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--color-bg)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #BD1D2D 0%, #8b0000 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 4px 12px rgba(189, 29, 45, 0.3)'
            }}>
              <Sliders size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text)' }}>
                Tùy biến Bàn làm việc
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                Cá nhân hóa hình nền và cách bố trí công việc cho tài khoản của bạn
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          
          {/* 1. Columns Selector */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <LayoutGrid size={16} style={{ color: 'var(--color-primary)' }} />
                Bố cục hiển thị (Số card trên mỗi hàng)
              </label>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', background: 'rgba(189, 29, 45, 0.08)', padding: '2px 8px', borderRadius: '12px' }}>
                {selectedCols} card / hàng
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              {[
                { cols: 3, label: '3 cột', desc: 'Rộng rãi' },
                { cols: 4, label: '4 cột', desc: 'Tiêu chuẩn' },
                { cols: 5, label: '5 cột', desc: 'Thu gọn' },
                { cols: 6, label: '6 cột', desc: 'Dày đặc' }
              ].map(opt => {
                const isSelected = selectedCols === opt.cols;
                return (
                  <button
                    key={opt.cols}
                    type="button"
                    onClick={() => setSelectedCols(opt.cols)}
                    style={{
                      padding: '12px 8px',
                      borderRadius: '12px',
                      border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                      backgroundColor: isSelected ? 'rgba(189, 29, 45, 0.06)' : 'var(--color-surface)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '2px', width: '100%', height: '14px', marginBottom: '4px', justifyContent: 'center' }}>
                      {Array.from({ length: opt.cols }).map((_, i) => (
                        <div
                          key={i}
                          style={{
                            flex: 1,
                            maxWidth: '12px',
                            height: '100%',
                            borderRadius: '2px',
                            background: isSelected ? 'var(--color-primary)' : 'var(--color-border)'
                          }}
                        />
                      ))}
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: isSelected ? 'var(--color-primary)' : 'var(--color-text)' }}>
                      {opt.label}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Wallpaper Selector */}
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <ImageIcon size={16} style={{ color: 'var(--color-primary)' }} />
              Hình nền Bàn làm việc
            </label>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px', marginBottom: '14px' }}>
              <button
                type="button"
                onClick={() => setActiveTab('wallpapers')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'wallpapers' ? 'var(--color-primary)' : 'transparent',
                  color: activeTab === 'wallpapers' ? '#fff' : 'var(--color-text-muted)'
                }}
              >
                Hình nền mẫu
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('patterns')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'patterns' ? 'var(--color-primary)' : 'transparent',
                  color: activeTab === 'patterns' ? '#fff' : 'var(--color-text-muted)'
                }}
              >
                Pattern & Gradient
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('custom')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'custom' ? 'var(--color-primary)' : 'transparent',
                  color: activeTab === 'custom' ? '#fff' : 'var(--color-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <UploadCloud size={14} />
                Tải ảnh từ máy
              </button>
            </div>

            {/* Tab 1: Wallpapers */}
            {activeTab === 'wallpapers' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }} className="custom-scrollbar-hidden">
                  {[
                    { id: 'all', label: `Tất cả (${PRESET_WALLPAPERS.length})` },
                    { id: 'Văn phòng', label: '💼 Văn phòng' },
                    { id: 'Thiên nhiên', label: '🏔️ Thiên nhiên' },
                    { id: 'Trừu tượng', label: '✨ Trừu tượng' },
                    { id: 'Tối giản', label: '🪴 Tối giản' }
                  ].map(cat => {
                    const isActive = wallpaperTag === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setWallpaperTag(cat.id)}
                        style={{
                          padding: '4px 12px',
                          borderRadius: '16px',
                          border: isActive ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                          backgroundColor: isActive ? 'rgba(189, 29, 45, 0.08)' : 'var(--color-bg)',
                          color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                          fontSize: '0.725rem',
                          fontWeight: isActive ? 700 : 500,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', maxHeight: '290px', overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
                  {PRESET_WALLPAPERS.filter(wp => wallpaperTag === 'all' || wp.tag === wallpaperTag || wp.id === 'default').map(wp => {
                    const isSelected = selectedBg === wp.url;
                    return (
                      <div
                        key={wp.id}
                        onMouseEnter={() => {
                          if (wp.url && (wp.url.startsWith('http') || wp.url.startsWith('/'))) {
                            const img = new Image();
                            try { (img as any).fetchPriority = 'high'; } catch (_) {}
                            img.src = wp.url;
                          }
                        }}
                        onClick={() => {
                          setSelectedBg(wp.url);
                          if (wp.url && (wp.url.startsWith('http') || wp.url.startsWith('/'))) {
                            const img = new Image();
                            try { (img as any).fetchPriority = 'high'; } catch (_) {}
                            img.src = wp.url;
                          }
                        }}
                        style={{
                          position: 'relative',
                          height: '90px',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          border: isSelected ? '2.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                          boxShadow: isSelected ? '0 0 0 3px rgba(189, 29, 45, 0.2)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {wp.url ? (
                          <img 
                            src={wp.preview} 
                            alt={wp.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ width: '100%', height: '100%', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Mặc định</span>
                          </div>
                        )}
                        
                        <div style={{
                          position: 'absolute',
                          bottom: 0,
                          insetInline: 0,
                          padding: '4px 6px',
                          background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span style={{ fontSize: '0.7rem', color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {wp.name}
                          </span>
                          {isSelected && (
                            <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Check size={11} color="#fff" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tab 2: Patterns */}
            {activeTab === 'patterns' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {PRESET_PATTERNS.map(pat => {
                  const isSelected = selectedBg === pat.url;
                  return (
                    <div
                      key={pat.id}
                      onClick={() => setSelectedBg(pat.url)}
                      style={{
                        position: 'relative',
                        height: '90px',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        background: pat.preview,
                        border: isSelected ? '2.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                        boxShadow: isSelected ? '0 0 0 3px rgba(189, 29, 45, 0.2)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        insetInline: 0,
                        padding: '4px 6px',
                        background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span style={{ fontSize: '0.7rem', color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {pat.name}
                        </span>
                        {isSelected && (
                          <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Check size={11} color="#fff" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tab 3: Upload Custom */}
            {activeTab === 'custom' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />

                <div 
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed var(--color-border)',
                    borderRadius: '14px',
                    padding: '24px 16px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    backgroundColor: 'var(--color-bg)',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
                >
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: 'rgba(189, 29, 45, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-primary)'
                  }}>
                    <UploadCloud size={24} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                      Bấm vào đây để tải ảnh nền của bạn
                    </span>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                      Yêu cầu tối thiểu: <strong>1280 x 720 px</strong> (Khuyến nghị <strong>1920 x 1080 px</strong> để không bị vỡ ảnh)
                    </p>
                  </div>
                </div>

                {(uploadedPreview || (selectedBg && selectedBg.startsWith('http'))) && (
                  <div style={{
                    position: 'relative',
                    height: '110px',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '2px solid var(--color-primary)'
                  }}>
                    <img
                      src={uploadedPreview || selectedBg}
                      alt="Custom preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: 'rgba(0,0,0,0.65)',
                      padding: '4px 8px',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '0.7rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Check size={12} color="#10b981" />
                      Đang chọn ảnh này
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. Overlay Opacity Slider */}
          {selectedBg && (
            <div style={{
              background: 'var(--color-bg)',
              padding: '14px 16px',
              borderRadius: '12px',
              border: '1px solid var(--color-border-light)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)' }}>
                  Độ mờ lớp phủ tương phản (Bảo vệ chữ rõ nét)
                </span>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                  {selectedOverlay}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={85}
                step={5}
                value={selectedOverlay}
                onChange={e => setSelectedOverlay(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--color-primary)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                <span>0% (Nguyên bản - Nhìn rõ ảnh)</span>
                <span>40% (Cân bằng)</span>
                <span>85% (Tối đa tương phản)</span>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--color-border-light)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--color-bg)'
        }}>
          <button
            type="button"
            onClick={handleReset}
            style={{
              background: 'transparent',
              border: '1px solid var(--color-border)',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              color: 'var(--color-text)',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RotateCcw size={14} />
            Đặt lại mặc định
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                padding: '8px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                color: 'var(--color-text)',
                fontSize: '0.8rem',
                fontWeight: 600
              }}
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleApply}
              style={{
                background: 'var(--color-primary)',
                border: 'none',
                padding: '8px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(189, 29, 45, 0.3)'
              }}
            >
              <Check size={16} />
              Áp dụng ngay
            </button>
          </div>
        </div>

      </motion.div>
    </div>,
    document.body
  );
};
