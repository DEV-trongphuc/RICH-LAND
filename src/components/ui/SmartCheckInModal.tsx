import React, { useState, useEffect, useRef } from 'react';
import { Camera, AlertTriangle, CheckCircle2, Clock, Sparkles, RefreshCw, X } from 'lucide-react';
import { CustomModal } from './CustomModal';
import { useLanguage } from '../../contexts/LanguageContext';
import { fetchAPI } from '../../utils/api';
import toast from 'react-hot-toast';

interface SmartCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  todayCheckIn: any;
  consultantProfile: any;
  user: any;
  onCheckInSuccess: () => void;
}

export const SmartCheckInModal: React.FC<SmartCheckInModalProps> = ({
  isOpen,
  onClose,
  todayCheckIn,
  consultantProfile,
  user,
  onCheckInSuccess
}) => {
  const { t } = useLanguage();

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [checkInReason, setCheckInReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Scanner & AI Auto Detection States
  const [faceScanProgress, setFaceScanProgress] = useState(0);
  const [scanStatusText, setScanStatusText] = useState('');

  // Success Screen State
  const [isSuccessScreen, setIsSuccessScreen] = useState(false);
  const [successMeta, setSuccessMeta] = useState<any>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const autoCapturedRef = useRef(false);

  const [isManualMode, setIsManualMode] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const checkIsLate = () => {
    const workStart = consultantProfile?.work_start_time || '08:00';
    const now = new Date();
    const curHM = now.toTimeString().substring(0, 5);
    return curHM > workStart;
  };

  const getMinutesLate = () => {
    const workStart = consultantProfile?.work_start_time || '08:00';
    const [startH, startM] = workStart.split(':').map(Number);
    const now = new Date();
    const currentH = now.getHours();
    const currentM = now.getMinutes();
    const startTotal = startH * 60 + startM;
    const currentTotal = currentH * 60 + currentM;
    return Math.max(0, currentTotal - startTotal);
  };

  const isLate = checkIsLate();
  const minutesLate = getMinutesLate();

  // Camera Control
  const startCamera = async () => {
    setCameraError('');
    setCapturedImage(null);
    setIsManualMode(false);
    autoCapturedRef.current = false;
    setFaceScanProgress(0);
    setScanStatusText(t('Vui lòng đưa khuôn mặt vào khung hình...'));

    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false
        });
      } catch (e1) {
        console.warn("Camera ideal constraint failed, retrying simple video constraint:", e1);
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      setCameraStream(stream);
      setIsCameraActive(true);
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraError(t('Không thể truy cập camera. Vui lòng cấp quyền camera trong trình duyệt hoặc tải ảnh selfie.'));
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  // Ensure camera stream is assigned to video element when stream or element becomes available
  useEffect(() => {
    if (cameraStream && videoRef.current) {
      const video = videoRef.current;
      video.srcObject = cameraStream;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('autoplay', 'true');
      video.muted = true;
      video.play().catch(err => console.log('Camera video play error:', err));
    }
  }, [cameraStream, isCameraActive]);

  // Start camera automatically when modal opens
  useEffect(() => {
    if (isOpen && (!todayCheckIn || todayCheckIn.status === 'rejected') && !isSuccessScreen) {
      startCamera();
    } else if (!isOpen) {
      stopCamera();
      setCapturedImage(null);
      setIsManualMode(false);
      setCheckInReason('');
      setIsSuccessScreen(false);
      setFaceScanProgress(0);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, todayCheckIn, isSuccessScreen]);

  // Capture current frame to dataUrl
  const takeSnapshot = (): string | null => {
    if (!videoRef.current) return null;
    const video = videoRef.current;
    const width = video.videoWidth || video.clientWidth || 640;
    const height = video.videoHeight || video.clientHeight || 480;
    if (width === 0 || height === 0) return null;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  const handleManualCapture = () => {
    if (!isManualMode) {
      setIsManualMode(true);
      setScanStatusText(t('Chế độ chụp ảnh thủ công'));
      return;
    }

    const dataUrl = takeSnapshot();
    if (dataUrl) {
      setCapturedImage(dataUrl);
      stopCamera();
      if (!isLate) {
        submitCheckIn(dataUrl);
      }
    } else {
      toast.error(t('Chưa nhận được khung hình camera. Vui lòng thử lại.'));
    }
  };

  // AI Face Detection & Auto Capture Loop
  useEffect(() => {
    if (!isCameraActive || capturedImage || isSuccessScreen || autoCapturedRef.current || isManualMode) {
      return;
    }

    let intervalId: any;
    let isDetecting = false;

    const detectFaceFrame = async () => {
      if (isDetecting || autoCapturedRef.current || !videoRef.current) return;
      isDetecting = true;

      const video = videoRef.current;
      if (video.readyState >= 2 && video.videoWidth > 0) {
        let detected = false;

        // 1. Native FaceDetector API
        if ('FaceDetector' in window) {
          try {
            const detector = new (window as any).FaceDetector({ fastMode: true, maxFaces: 1 });
            const faces = await detector.detect(video);
            if (faces && faces.length > 0) {
              detected = true;
            }
          } catch (e) {}
        }

        // 2. Luminance & Face Region Density Fallback
        if (!detected) {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 120;
            canvas.height = 90;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, 120, 90);
              const imgData = ctx.getImageData(30, 15, 60, 60);
              const data = imgData.data;
              let skinPixelCount = 0;
              for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i+1], b = data[i+2];
                if (r > 60 && g > 40 && b > 20 && r > g && r > b && (Math.max(r, g, b) - Math.min(r, g, b) > 15)) {
                  skinPixelCount++;
                }
              }
              if (skinPixelCount > (data.length / 4) * 0.12) {
                detected = true;
              }
            }
          } catch (e) {}
        }

        if (detected) {
          setFaceScanProgress(prev => {
            const next = prev + 30;
            if (next >= 100 && !autoCapturedRef.current) {
              autoCapturedRef.current = true;
              setScanStatusText(t('Đã phát hiện khuôn mặt! Đang tự động chụp...'));
              
              setTimeout(() => {
                const autoPic = takeSnapshot();
                if (autoPic) {
                  setCapturedImage(autoPic);
                  stopCamera();
                  if (!isLate) {
                    submitCheckIn(autoPic);
                  } else {
                    toast.success(t('Đã tự động quét khuôn mặt! Vui lòng nhập lý do đi trễ.'));
                  }
                }
              }, 200);
              return 100;
            }
            setScanStatusText(t('Đã tìm thấy khuôn mặt... Giữ yên!'));
            return next;
          });
        } else {
          setFaceScanProgress(prev => Math.max(0, prev - 15));
          setScanStatusText(t('Đưa khuôn mặt vào hình bầu dục...'));
        }
      }
      isDetecting = false;
    };

    intervalId = setInterval(detectFaceFrame, 220);

    return () => {
      clearInterval(intervalId);
    };
  }, [isCameraActive, capturedImage, isSuccessScreen, isLate]);

  // Submit Check-in API
  const submitCheckIn = async (overrideImage?: string) => {
    const imageToUse = overrideImage || capturedImage;
    if (!imageToUse || submitting) return;

    if (isLate && !checkInReason.trim()) {
      toast.error(t('Bạn đi trễ. Vui lòng điền lý do để gửi duyệt.'));
      return;
    }

    setSubmitting(true);
    let coords: { latitude: number; longitude: number } | null = null;
    try {
      coords = await new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error(t('Trình duyệt của bạn không hỗ trợ định vị GPS.')));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            });
          },
          (error) => {
            let msg = t('Không thể lấy vị trí GPS. Vui lòng bật định vị.');
            if (error.code === error.PERMISSION_DENIED) {
              msg = t('Vui lòng cấp quyền truy cập vị trí (GPS) trên trình duyệt để chấm công.');
            }
            reject(new Error(msg));
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      });
    } catch (gpsError: any) {
      toast.error(gpsError.message);
      setSubmitting(false);
      return;
    }

    let addressStr = '';
    if (coords) {
      try {
        const geoUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}&accept-language=vi`;
        const geoRes = await fetch(geoUrl, {
          headers: {
            'Accept-Language': 'vi',
            'User-Agent': 'RichLandCRM/1.0'
          }
        });
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          addressStr = geoData.display_name || '';
        }
      } catch (addrErr) {
        console.warn("Failed to reverse-geocode coordinates:", addrErr);
      }
    }

    try {
      const compressToWebP = (dataUrl: string): Promise<Blob> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.src = dataUrl;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              canvas.toBlob((b) => {
                if (b) resolve(b);
                else reject(new Error('WebP conversion failed'));
              }, 'image/webp', 0.8);
            } else {
              reject(new Error('Canvas context error'));
            }
          };
          img.onerror = () => reject(new Error('Image loading error'));
        });
      };

      const webpBlob = await compressToWebP(imageToUse);
      const file = new File([webpBlob], `selfie_${Date.now()}.webp`, { type: 'image/webp' });
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadRes = await fetchAPI('upload', {
        method: 'POST',
        body: formData
      });

      if (!uploadRes.success || !uploadRes.data?.url) {
        toast.error(uploadRes.message || t('Lỗi tải ảnh lên'));
        setSubmitting(false);
        return;
      }

      const res = await fetchAPI('check-ins', {
        method: 'POST',
        body: JSON.stringify({
          selfie_url: uploadRes.data.url,
          reason: isLate ? checkInReason : null,
          latitude: coords?.latitude?.toString() || '',
          longitude: coords?.longitude?.toString() || '',
          location_address: addressStr
        })
      });

      if (res.success) {
        stopCamera();
        const now = new Date();
        const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const dateStr = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

        setSuccessMeta({ time: timeStr, date: dateStr, isLate });
        setIsSuccessScreen(true);

        // Auto close modal after 2s
        setTimeout(() => {
          setIsSuccessScreen(false);
          onCheckInSuccess();
          onClose();
        }, 2000);
      } else {
        toast.error(res.message || t('Check-in thất bại'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi check-in: ') + err.message);
    }
    setSubmitting(false);
  };

  const circumference = 2 * Math.PI * 135; // r = 135
  const strokeDashoffset = circumference - (circumference * faceScanProgress) / 100;

  return (
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title={isSuccessScreen ? '' : t("CHẤM CÔNG HÀNG NGÀY")}
      width="100%"
      maxWidth="500px"
      fullScreenOnMobile={true}
      modalClassName="checkin-modal-dark"
    >
      {/* 1. Already Checked-In State */}
      {todayCheckIn && todayCheckIn.status !== 'rejected' && !isSuccessScreen ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: isMobile ? '70dvh' : 'auto',
          gap: '1.5rem',
          padding: '1.5rem 1rem',
          textAlign: 'center'
        }}>
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: todayCheckIn.status === 'approved' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
            color: todayCheckIn.status === 'approved' ? 'var(--color-success)' : 'var(--color-warning)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.5rem',
            fontWeight: 'bold',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.15)'
          }}>
            {todayCheckIn.status === 'approved' ? <CheckCircle2 size={38} /> : <Clock size={38} />}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text)' }}>
              {todayCheckIn.status === 'approved' ? t('Đã Chấm công Thành công') : t('Đang chờ phê duyệt đi trễ')}
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '6px 0 0' }}>
              {t('Thời gian chấm công:')} <b>{todayCheckIn.check_in_time ? todayCheckIn.check_in_time.substring(0, 5) : ''}</b> ngày {todayCheckIn.check_in_date}
            </p>
          </div>
          {todayCheckIn.reason && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', margin: 0, fontStyle: 'italic', background: 'var(--color-bg)', padding: '8px 16px', borderRadius: '8px', border: '1px dashed var(--color-border)' }}>
              "{todayCheckIn.reason}"
            </p>
          )}
          <button className="btn primary" onClick={onClose} style={{ backgroundColor: '#BD1D2D', border: 'none', borderRadius: '24px', padding: '10px 32px', fontWeight: 600, marginTop: '0.5rem' }}>
            {t('Đồng ý')}
          </button>
        </div>
      ) : isSuccessScreen ? (
        /* 2. Stunning Success Screen (Auto Closes after 2s) */
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: isMobile ? '70dvh' : 'auto',
          padding: '2.5rem 1.5rem',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Animated Glowing Ring Aura */}
          <div style={{ position: 'relative', width: 90, height: 90, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="checkin-pulse-ring" />
            <div 
              className="checkin-success-badge"
              style={{
                width: 84,
                height: 84,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 12px 30px rgba(16, 185, 129, 0.4)',
                zIndex: 2
              }}
            >
              <CheckCircle2 size={46} strokeWidth={2.5} />
            </div>
          </div>

          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text)', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
            {t('CHẤM CÔNG THÀNH CÔNG!')}
          </h2>
          
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0 0 1.25rem 0', maxWidth: '340px', lineHeight: 1.5 }}>
            {successMeta?.isLate 
              ? t('Yêu cầu đi trễ đã gửi tới quản lý. Đã ghi nhận thời gian chấm công!')
              : t('Cổng nhận data tự động hôm nay đã mở. Chúc bạn giao dịch chốt cọc bùng nổ!')}
          </p>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 16px',
            borderRadius: '20px',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            color: '#10b981',
            fontSize: '0.8125rem',
            fontWeight: 700,
            marginBottom: '2rem'
          }}>
            <Clock size={15} />
            <span>{successMeta?.time || ''} • {successMeta?.date || ''}</span>
          </div>

          {/* 2s Animated Countdown Progress Bar */}
          <div style={{ width: '100%', maxWidth: '260px', height: 4, background: 'var(--color-border-light)', borderRadius: 99, overflow: 'hidden' }}>
            <div className="checkin-progress-bar" style={{ height: '100%', background: 'linear-gradient(90deg, #10b981, #059669)', borderRadius: 99 }} />
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 8 }}>
            {t('Tự động đóng sau 2 giây...')}
          </span>
        </div>
      ) : (
        /* 3. Main Scanner & Camera Check-in Flow */
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: isMobile ? '76dvh' : 'auto',
          gap: '1.25rem',
          padding: '0.5rem 0'
        }}>
          {/* Header Info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              {t('Tự động quét & nhận diện khuôn mặt')}
            </span>
            <div style={{
              backgroundColor: 'var(--color-bg)',
              color: 'var(--color-text)',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: 700,
              border: '1px solid var(--color-border)'
            }}>
              {t('Quy định:')} <span style={{ color: '#BD1D2D' }}>{consultantProfile?.work_start_time || '08:00'}</span>
            </div>
          </div>

          {/* Middle Biometric Scanner Area (Centered Vertically on Mobile) */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            margin: '1.5rem 0',
            position: 'relative'
          }}>
            {/* AI Scanner Circular Feed */}
            <div style={{ position: 'relative', width: '280px', height: '280px' }}>
              {/* Biometric Scanning Target Brackets & Radar Rings */}
              {(() => {
                const isHighProgress = faceScanProgress > 60;
                const targetColor = isHighProgress ? '#10b981' : '#3b82f6';
                return (
                  <>
                    {/* Outer Pulsing Radar Rings */}
                    <div className={`checkin-radar-ring ${isHighProgress ? 'active' : ''}`} />
                    <div className={`checkin-radar-ring-2 ${isHighProgress ? 'active' : ''}`} />

                    {/* Corner Targets */}
                    <div style={{ position: 'absolute', top: -14, left: -14, width: 22, height: 22, borderLeft: `3px solid ${targetColor}`, borderTop: `3px solid ${targetColor}`, borderTopLeftRadius: '8px', transition: 'border-color 0.25s ease', zIndex: 6 }} />
                    <div style={{ position: 'absolute', top: -14, right: -14, width: 22, height: 22, borderRight: `3px solid ${targetColor}`, borderTop: `3px solid ${targetColor}`, borderTopRightRadius: '8px', transition: 'border-color 0.25s ease', zIndex: 6 }} />
                    <div style={{ position: 'absolute', bottom: -14, left: -14, width: 22, height: 22, borderLeft: `3px solid ${targetColor}`, borderBottom: `3px solid ${targetColor}`, borderBottomLeftRadius: '8px', transition: 'border-color 0.25s ease', zIndex: 6 }} />
                    <div style={{ position: 'absolute', bottom: -14, right: -14, width: 22, height: 22, borderRight: `3px solid ${targetColor}`, borderBottom: `3px solid ${targetColor}`, borderBottomRightRadius: '8px', transition: 'border-color 0.25s ease', zIndex: 6 }} />
                  </>
                );
              })()}

              {/* Animated SVG Progress Ring */}
              <svg style={{ position: 'absolute', top: -10, left: -10, width: 300, height: 300, transform: 'rotate(-90deg)', zIndex: 12, pointerEvents: 'none' }}>
                <circle
                  cx="150"
                  cy="150"
                  r="135"
                  stroke="var(--color-border-light)"
                  strokeWidth="4"
                  fill="transparent"
                />
                <circle
                  cx="150"
                  cy="150"
                  r="135"
                  stroke={faceScanProgress >= 100 ? '#10b981' : '#3b82f6'}
                  strokeWidth="5"
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.25s ease, stroke 0.3s ease' }}
                />
              </svg>

              {/* Video Container */}
              <div style={{
                position: 'relative',
                width: '280px',
                height: '280px',
                backgroundColor: '#0a0a0a',
                borderRadius: '50%',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: faceScanProgress > 60 ? '3px solid #10b981' : '3px solid rgba(255, 255, 255, 0.15)',
                boxShadow: faceScanProgress > 60 ? '0 0 35px rgba(16, 185, 129, 0.25)' : '0 12px 32px rgba(0,0,0,0.25)',
                transition: 'all 0.3s ease',
                zIndex: 10
              }}>
                {capturedImage ? (
                  <img
                    src={capturedImage}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    alt="Selfie"
                  />
                ) : isCameraActive ? (
                  <>
                    <video
                      ref={videoRef}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                      autoPlay
                      playsInline
                      muted
                    />
                    {!isManualMode && (
                      <>
                        {/* Biometric Holographic Tech HUD Overlay */}
                        <div className={`checkin-scanner-hud ${faceScanProgress > 60 ? 'active' : ''}`} />

                        {/* Vertical Laser Scan Line Animation */}
                        <div className="checkin-scan-laser" />

                        {/* Translucent Face Oval Target Guide */}
                        <div style={{
                          position: 'absolute',
                          width: '160px',
                          height: '210px',
                          borderRadius: '50%',
                          border: faceScanProgress > 60 ? '2px dashed #10b981' : '2px dashed rgba(255,255,255,0.4)',
                          boxShadow: faceScanProgress > 60 ? '0 0 20px rgba(16, 185, 129, 0.3)' : 'none',
                          pointerEvents: 'none',
                          transition: 'all 0.3s ease'
                        }} />
                      </>
                    )}
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#fff', padding: '20px', textAlign: 'center' }}>
                    <Camera size={44} style={{ opacity: 0.5 }} />
                    <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                      {cameraError || t('Đang tải camera...')}
                    </span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      <button
                        type="button"
                        className="btn primary sm"
                        onClick={startCamera}
                        style={{ backgroundColor: '#BD1D2D', border: 'none', borderRadius: '20px' }}
                      >
                        {t('Kích hoạt Camera')}
                      </button>
                      <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
                        <input
                          type="file"
                          accept="image/*"
                          capture="user"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                const res = ev.target?.result as string;
                                if (res) {
                                  setCapturedImage(res);
                                  stopCamera();
                                  if (!isLate) submitCheckIn(res);
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        <span className="btn outline sm" style={{ borderRadius: '20px', borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }}>
                          {t('Tải ảnh selfie')}
                        </span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Floating Status Pill - Positioned below the Circular Camera Frame */}
            {isCameraActive && !capturedImage && (
              <div style={{
                marginTop: '16px',
                backgroundColor: faceScanProgress > 60 ? 'rgba(16, 185, 129, 0.95)' : 'rgba(15, 23, 42, 0.9)',
                backdropFilter: 'blur(8px)',
                color: '#fff',
                padding: '6px 18px',
                borderRadius: '20px',
                fontSize: '0.78rem',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                border: faceScanProgress > 60 ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(255, 255, 255, 0.15)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                zIndex: 15
              }}>
                <Sparkles size={13} className={faceScanProgress > 60 ? 'spin' : ''} />
                <span>
                  {faceScanProgress > 0 && faceScanProgress < 100
                    ? `${scanStatusText} (${faceScanProgress}%)`
                    : scanStatusText}
                </span>
              </div>
            )}

            {/* Captured Actions or Manual Retake */}
            {capturedImage && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: '1rem', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', width: '100%' }}>
                  <button
                    type="button"
                    className="btn outline sm"
                    onClick={startCamera}
                    disabled={submitting}
                    style={{ borderRadius: '20px', padding: '6px 18px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <RefreshCw size={14} />
                    {t('Quét lại')}
                  </button>

                  <button
                    type="button"
                    className="btn primary sm"
                    disabled={submitting || (isLate && !checkInReason.trim())}
                    onClick={() => submitCheckIn()}
                    style={{
                      backgroundColor: '#BD1D2D',
                      color: '#fff',
                      borderRadius: '20px',
                      padding: '8px 24px',
                      fontWeight: 700,
                      boxShadow: '0 4px 15px rgba(189, 29, 45, 0.4)',
                      border: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {submitting ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <RefreshCw size={14} className="spin" /> {t('Đang gửi...')}
                      </span>
                    ) : (
                      t('Xác nhận Chấm công')
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Area: Late Reason & Control Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Late Reason Input */}
            {isLate && capturedImage && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(189, 29, 45, 0.03) 0%, rgba(189, 29, 45, 0.08) 100%)',
                border: '1px solid rgba(189, 29, 45, 0.18)',
                borderRadius: '16px',
                padding: '16px',
                boxShadow: '0 8px 30px rgba(189, 29, 45, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                transition: 'all 0.3s ease'
              }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: '#991b1b', fontSize: '0.875rem', fontWeight: 800 }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(189, 29, 45, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertTriangle size={15} />
                  </div>
                  {t('Bạn đã trễ') + ` ${minutesLate} ` + t('phút!')}
                </div>
                <p style={{ fontSize: '0.78rem', color: '#4b5563', margin: 0, lineHeight: 1.4 }}>
                  {t('Vui lòng điền lý do đi trễ để Quản lý duyệt mở cổng nhận data.')}
                </p>
                <textarea
                  className="form-control"
                  style={{
                    width: '100%',
                    height: '70px',
                    fontSize: '0.8125rem',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--color-border)',
                    background: '#ffffff',
                    color: '#1e293b',
                    resize: 'none',
                    outline: 'none',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
                    transition: 'all 0.25s ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#BD1D2D';
                    e.target.style.boxShadow = '0 0 0 3px rgba(189, 29, 45, 0.12)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--color-border)';
                    e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.02)';
                  }}
                  placeholder={t('Ví dụ: Kẹt xe, đi gặp khách hàng từ sớm...')}
                  value={checkInReason}
                  onChange={(e) => setCheckInReason(e.target.value)}
                  required
                />
              </div>
            )}

            {/* Manual Capture Option (Shown only during active scanning) */}
            {isCameraActive && !capturedImage && (
              <div style={{ textAlign: 'center', marginTop: '1rem', paddingBottom: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleManualCapture}
                  style={{
                    background: isManualMode ? '#BD1D2D' : 'transparent',
                    border: 'none',
                    color: isManualMode ? '#ffffff' : '#94a3b8',
                    fontSize: '0.8125rem',
                    fontWeight: isManualMode ? 700 : 500,
                    cursor: 'pointer',
                    padding: isManualMode ? '10px 28px' : '4px 12px',
                    borderRadius: isManualMode ? '24px' : '0',
                    textDecoration: isManualMode ? 'none' : 'underline',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    margin: '0 auto',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isManualMode && <Camera size={16} />}
                  <span>{isManualMode ? t('Chụp ảnh thủ công') : t('Không nhận diện được khuôn mặt')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </CustomModal>
  );
};
