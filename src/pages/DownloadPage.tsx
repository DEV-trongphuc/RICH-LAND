import React, { useState, useEffect } from 'react';
import { 
  Download, Laptop, Monitor, ShieldCheck, Zap, BellRing, 
  ArrowLeft, AlertCircle, CheckCircle2, ChevronRight, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function DownloadPage() {
  const [detectedOS, setDetectedOS] = useState<'windows' | 'mac' | 'linux' | 'other'>('windows');
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [showDevModal, setShowDevModal] = useState(false);
  const [targetDownloadOS, setTargetDownloadOS] = useState<'windows' | 'mac' | 'linux'>('windows');

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (userAgent.includes('win')) {
      setDetectedOS('windows');
    } else if (userAgent.includes('mac') || userAgent.includes('os x')) {
      setDetectedOS('mac');
    } else if (userAgent.includes('linux')) {
      setDetectedOS('linux');
    } else {
      setDetectedOS('other');
    }
  }, []);

  const handleDownload = (osType: 'windows' | 'mac' | 'linux') => {
    setTargetDownloadOS(osType);
    setShowDevModal(true);
  };

  const getOSDisplayName = (os: typeof detectedOS) => {
    switch (os) {
      case 'windows': return 'Windows (x64)';
      case 'mac': return 'macOS (Intel & Apple Silicon)';
      case 'linux': return 'Linux (.deb)';
      default: return 'Thiết bị của bạn';
    }
  };

  return (
    <div className="download-dark-theme" style={{
      width: '100%',
      flex: 1,
      minHeight: '100vh',
      background: '#09090D',
      color: '#F3F4F6',
      fontFamily: '"Outfit", "Inter", system-ui, -apple-system, sans-serif',
      padding: '2.5rem 2rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      position: 'relative',
      overflow: 'hidden',
      boxSizing: 'border-box'
    }}>
      {/* Immersive radial glows */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        left: '10%',
        width: '600px',
        height: '600px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(189, 29, 45, 0.15) 0%, transparent 70%)',
        filter: 'blur(60px)',
        pointerEvents: 'none',
        zIndex: 0
      }} />
      <div style={{
        position: 'absolute',
        bottom: '10%',
        right: '5%',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)',
        filter: 'blur(50px)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Futuristic Grid Overlay */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        maskImage: 'radial-gradient(ellipse at center, black, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(ellipse at center, black, transparent 80%)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Header Container */}
      <header style={{ 
        width: '100%', 
        maxWidth: '1280px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '4rem',
        position: 'relative',
        zIndex: 2
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img src="/LOGO.jpg" alt="Rich Land Logo" style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }} />
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '0.05em', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
              RICH LAND <span style={{ fontSize: '0.65rem', padding: '2px 6px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', color: '#9CA3AF' }}>V1.0</span>
            </div>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#BD1D2D', textTransform: 'uppercase', letterSpacing: '0.15em' }}>DATA AUTOMATION</div>
          </div>
        </div>

        <a href="/" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.85rem',
          fontWeight: 700,
          color: '#E5E7EB',
          textDecoration: 'none',
          padding: '10px 20px',
          borderRadius: '10px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(8px)',
          transition: 'all 0.25s'
        }} className="back-web-btn">
          <ArrowLeft size={15} />
          Quay lại bản Web
        </a>
      </header>

      {/* Main Content Area (Full Width Grid) */}
      <main style={{ 
        width: '100%', 
        maxWidth: '1280px', 
        display: 'grid', 
        gridTemplateColumns: '1.1fr 1fr', 
        gap: '4rem', 
        alignItems: 'start',
        position: 'relative',
        zIndex: 2,
        paddingBottom: '4rem'
      }} className="main-download-grid">
        
        {/* Left Column: Hero Copy & Prime CTA Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span style={{
              background: 'rgba(189, 29, 45, 0.15)',
              border: '1px solid rgba(189, 29, 45, 0.3)',
              color: '#FF4B5F',
              padding: '6px 14px',
              borderRadius: '30px',
              fontSize: '0.75rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '1.25rem'
            }}>
              <Monitor size={14} /> ĐÓNG GÓI TAURI DESKTOP CLIENT
            </span>
            <h1 style={{ 
              fontSize: '2.35rem', 
              fontWeight: 900, 
              lineHeight: 1.2,
              color: '#FFFFFF',
              marginBottom: '1rem',
              letterSpacing: '-0.02em'
            }}>
              Trải nghiệm <span className="text-gradient">Rich Land</span> chuyên nghiệp trên Máy tính
            </h1>
            <p style={{ 
              fontSize: '1.05rem', 
              color: '#9CA3AF', 
              lineHeight: 1.6,
              margin: 0
            }}>
              Phiên bản Desktop được thiết kế riêng nhằm mang lại tốc độ phản hồi tối đa, kết nối trực tiếp vào khay hệ thống, giúp bạn giám sát và cập nhật dự án/leads ngay lập tức mà không phụ thuộc vào trình duyệt.
            </p>
          </motion.div>

          {/* Premium Glass Action Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="glass-card"
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '24px',
              padding: '2.5rem',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
              position: 'relative',
              overflow: 'hidden',
              backdropFilter: 'blur(16px)'
            }}
          >
            {/* Inner ambient glow */}
            <div style={{
              position: 'absolute',
              top: '-50%', right: '-50%',
              width: '250px', height: '250px',
              background: 'radial-gradient(circle, rgba(189, 29, 45, 0.1) 0%, transparent 70%)',
              pointerEvents: 'none'
            }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                    Phiên bản phù hợp với bạn
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Laptop size={24} style={{ color: '#FF4B5F' }} />
                    {getOSDisplayName(detectedOS)}
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#9CA3AF', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  v1.0.0
                </div>
              </div>

              {/* Glowing CTA Button */}
              <button 
                onClick={() => handleDownload(detectedOS === 'other' ? 'windows' : detectedOS)}
                disabled={downloadStarted}
                className="glowing-download-btn"
                style={{
                  background: 'linear-gradient(135deg, #BD1D2D 0%, #FF4B5F 100%)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '18px 30px',
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  boxShadow: '0 8px 30px rgba(189, 29, 45, 0.4)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative'
                }}
              >
                {downloadStarted ? (
                  <>
                    <RefreshCw size={20} className="spin" />
                    Đang chuẩn bị link tải...
                  </>
                ) : (
                  <>
                    <Download size={22} />
                    Tải bản cài đặt cho {detectedOS === 'mac' ? 'macOS' : 'Windows'}
                  </>
                )}
              </button>

              {downloadStarted && (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.05)',
                  border: '1px solid rgba(16, 185, 129, 0.15)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  fontSize: '0.825rem',
                  color: '#34D399',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <CheckCircle2 size={18} />
                  <span>Trình duyệt đang thực hiện tải file. Vui lòng kiểm tra mục Tải xuống!</span>
                </div>
              )}

              {/* Other OS Selector */}
              <div style={{ marginTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                  Hệ điều hành khác:
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {detectedOS !== 'windows' && (
                    <button onClick={() => handleDownload('windows')} className="capsule-os-btn">
                      Windows (.msi)
                    </button>
                  )}
                  {detectedOS !== 'mac' && (
                    <button onClick={() => handleDownload('mac')} className="capsule-os-btn">
                      macOS (.dmg)
                    </button>
                  )}
                  {detectedOS !== 'linux' && (
                    <button onClick={() => handleDownload('linux')} className="capsule-os-btn">
                      Linux (.deb)
                    </button>
                  )}
                </div>
              </div>

            </div>
          </motion.div>
        </div>

        {/* Right Column: Premium Feature Cards & Security bypass guide */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Features Wrapper */}
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#FFFFFF', marginBottom: '1.5rem', letterSpacing: '-0.01em' }}>
              Các ưu thế của bản Desktop Client
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {[
                {
                  icon: Zap,
                  title: 'Nhẹ và Siêu Tốc (Tauri Core)',
                  desc: 'Không cồng kềnh như Electron. Tauri sử dụng webview gốc tích hợp sẵn của hệ điều hành nên dung lượng tải chỉ 10MB, tiêu hao cực ít RAM và chạy tức thì.'
                },
                {
                  icon: BellRing,
                  title: 'Thông báo đẩy hệ thống tức thời',
                  desc: 'Được tích hợp sâu vào System Notification. Ngay cả khi thu nhỏ ứng dụng xuống khay hệ thống, bạn vẫn nhận được cảnh báo lead mới ngay lập tức.'
                },
                {
                  icon: ShieldCheck,
                  title: 'Độ tin cậy & Bảo mật cao',
                  desc: 'Bảo mật luồng dữ liệu cục bộ cao cấp qua SSL mã hóa. Ứng dụng tự kiểm tra chữ ký cập nhật (Auto-update) mỗi khi mở máy để đảm bảo bạn luôn ở bản mới nhất.'
                }
              ].map((f, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '16px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: 'rgba(189, 29, 45, 0.08)',
                    border: '1px solid rgba(189, 29, 45, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FF4B5F',
                    flexShrink: 0
                  }}>
                    <f.icon size={20} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 6px 0', color: '#FFFFFF' }}>{f.title}</h4>
                    <p style={{ fontSize: '0.825rem', color: '#9CA3AF', margin: 0, lineHeight: 1.5 }}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Glass-guide alert container */}
          <div style={{
            background: 'rgba(239, 68, 68, 0.02)',
            border: '1px solid rgba(239, 68, 68, 0.15)',
            borderRadius: '20px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            backdropFilter: 'blur(12px)'
          }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 950, margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              <AlertCircle size={18} /> Lưu ý vượt qua rào bảo mật OS
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.8rem', color: '#D1D5DB', lineHeight: 1.5 }}>
              <div>
                <strong style={{ color: '#FFFFFF' }}>1. Trên Windows SmartScreen:</strong><br />
                Khi chạy file `.msi` lần đầu, nếu hệ thống hiển thị thông báo *Windows protected your PC*, hãy bấm vào link <span style={{ color: '#FF4B5F', fontWeight: 700 }}>More info</span> sau đó chọn nút <span style={{ color: '#FF4B5F', fontWeight: 700 }}>Run anyway</span>.
              </div>
              
              <div style={{ borderTop: '1px solid rgba(239, 68, 68, 0.1)', paddingTop: '12px' }}>
                <strong style={{ color: '#FFFFFF' }}>2. Trên macOS Gatekeeper:</strong><br />
                Hãy kéo file ứng dụng vào thư mục *Applications*. Nếu nhận được cảnh báo không thể mở ứng dụng, truy cập vào mục <span style={{ fontWeight: 700 }}>System Settings &gt; Privacy & Security</span>, tìm mục ứng dụng chặn và nhấn nút <span style={{ color: '#3b82f6', fontWeight: 700 }}>Open Anyway</span> để cấp quyền.
              </div>
            </div>
          </div>

        </div>

      </main>

      {/* Footer */}
      <footer style={{ 
        width: '100%',
        borderTop: '1px solid rgba(255, 255, 255, 0.04)',
        marginTop: 'auto',
        paddingTop: '2rem', 
        fontSize: '0.75rem', 
        color: '#6B7280', 
        textAlign: 'center',
        position: 'relative',
        zIndex: 2
      }}>
        © 2026 Rich Land Việt Nam. Bản quyền ứng dụng được bảo hộ trên nền tảng Tauri Secure App Sandbox.
      </footer>

      {/* Dev Mode Explanation Modal */}
      <AnimatePresence>
        {showDevModal && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1.5rem'
          }}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              style={{
                background: '#0F0F15',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '24px',
                padding: '2.5rem',
                maxWidth: '550px',
                width: '100%',
                boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem', color: '#FF4B5F' }}>
                <AlertCircle size={28} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0, color: '#FFFFFF' }}>
                  Bản cài đặt đang được khởi tạo
                </h3>
              </div>

              <p style={{ fontSize: '0.875rem', color: '#9CA3AF', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                Chào bạn! Vì dự án đang chạy dưới môi trường phát triển cục bộ (<code style={{ color: '#FF4B5F', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>localhost</code>), tệp tin cài đặt <strong style={{ color: '#FFFFFF' }}>.{targetDownloadOS === 'mac' ? 'dmg' : 'msi'}</strong> chưa được biên dịch và đặt vào thư mục tĩnh.
              </p>

              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '16px',
                padding: '1.25rem',
                marginBottom: '1.5rem'
              }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '8px' }}>
                  HƯỚNG DẪN BUILD FILE CÀI ĐẶT:
                </div>
                <ol style={{ fontSize: '0.75rem', color: '#9CA3AF', paddingLeft: '1.2rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: 1.5 }}>
                  <li>Cài đặt Rust và Build Tools tương ứng trên máy tính của bạn.</li>
                  <li>Chạy lệnh khởi tạo Tauri: <code style={{ color: '#3b82f6' }}>npm run tauri init</code> (nếu chưa cấu hình).</li>
                  <li>Đóng gói ứng dụng: chạy lệnh <code style={{ color: '#3b82f6' }}>npm run tauri build</code> hoặc <code style={{ color: '#3b82f6' }}>npx tauri build</code>.</li>
                  <li>Copy file cài đặt sau khi build vào thư mục <code style={{ color: '#FFFFFF' }}>public/downloads/</code> trong mã nguồn để kích hoạt tính năng tải về trực tiếp.</li>
                </ol>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button 
                  onClick={() => {
                    setDownloadStarted(true);
                    let filename = '';
                    if (targetDownloadOS === 'windows') {
                      filename = 'Rich_Land_Desktop_1.0.0_x64_en-US.msi';
                    } else if (targetDownloadOS === 'mac') {
                      filename = 'Rich-Land-Desktop_1.0.0_x64.dmg';
                    } else {
                      filename = 'rich-land-desktop_1.0.0_amd64.deb';
                    }
                    const link = document.createElement('a');
                    link.href = `/downloads/${filename}`;
                    link.setAttribute('download', filename);
                    document.body.appendChild(link);
                    try { link.click(); } catch(e) {}
                    document.body.removeChild(link);
                    setShowDevModal(false);
                    setTimeout(() => {
                      setDownloadStarted(false);
                    }, 6000);
                  }}
                  className="capsule-os-btn"
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#9CA3AF'
                  }}
                >
                  Vẫn tải thử file test
                </button>
                <button 
                  onClick={() => setShowDevModal(false)}
                  style={{
                    background: 'linear-gradient(135deg, #BD1D2D 0%, #FF4B5F 100%)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '10px 20px',
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(189, 29, 45, 0.3)'
                  }}
                >
                  Đã hiểu
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CSS overrides for dark landing page elements */}
      <style>{`
        .download-dark-theme {
          animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.99); }
          to { opacity: 1; transform: scale(1); }
        }
        .text-gradient {
          background: linear-gradient(135deg, #FF4B5F 0%, #BD1D2D 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .back-web-btn:hover {
          background: rgba(255, 255, 255, 0.08) !important;
          border-color: rgba(255, 255, 255, 0.15) !important;
          transform: translateY(-2px);
        }
        .glowing-download-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(189, 29, 45, 0.55) !important;
          background: linear-gradient(135deg, #FF4B5F 0%, #ff6274 100%) !important;
        }
        .glowing-download-btn:active {
          transform: translateY(0);
        }
        .capsule-os-btn {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 30px;
          padding: 8px 16px;
          font-size: 0.775rem;
          font-weight: 700;
          color: #D1D5DB;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .capsule-os-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
          color: #FFFFFF;
          transform: translateY(-1px);
        }
        @media (max-width: 900px) {
          .main-download-grid {
            grid-template-columns: 1fr !important;
            gap: 3rem !important;
            padding-bottom: 2rem !important;
          }
          .download-dark-theme {
            padding: 1.5rem 1rem !important;
          }
        }
      `}</style>
    </div>
  );
}
