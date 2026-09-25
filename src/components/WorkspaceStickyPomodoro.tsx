import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Clock, Play, Pause, RotateCcw, Eye } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';

export const WorkspaceStickyPomodoro: React.FC = () => {
  const { t } = useLanguage();
  
  const [mode, setMode] = useState<'work' | 'break'>('work');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const [totalSessions, setTotalSessions] = useState(() => {
    const today = new Date().toDateString();
    const savedDate = localStorage.getItem('pomodoro_date');
    if (savedDate === today) {
      return Number(localStorage.getItem('pomodoro_sessions')) || 0;
    }
    return 0;
  });

  const timerRef = useRef<any>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const today = new Date().toDateString();
    localStorage.setItem('pomodoro_date', today);
    localStorage.setItem('pomodoro_sessions', String(totalSessions));
  }, [totalSessions]);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, mode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (widgetRef.current && !widgetRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const playAlertSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);

      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioCtx.close();
      }, 800);
    } catch (e) {}
  };

  const handleTimerComplete = () => {
    setIsRunning(false);
    playAlertSound();

    if (mode === 'work') {
      setTotalSessions(prev => prev + 1);
      toast.success(t('🎉 Tuyệt vời! Bạn đã hoàn thành 25 phút tập trung cao độ. Hãy nghỉ ngơi 5 phút nhé!'), { duration: 6000 });
      setMode('break');
      setTimeLeft(5 * 60);
    } else {
      toast.success(t('☕ Thời gian giải lao đã hết. Bắt đầu phiên làm việc mới nào!'), { duration: 6000 });
      setMode('work');
      setTimeLeft(25 * 60);
    }
  };

  const toggleTimer = () => setIsRunning(!isRunning);

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(mode === 'work' ? 25 * 60 : 5 * 60);
  };

  const switchMode = (newMode: 'work' | 'break') => {
    setIsRunning(false);
    setMode(newMode);
    setTimeLeft(newMode === 'work' ? 25 * 60 : 5 * 60);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false);

  useEffect(() => {
    let lastIsMobile = typeof window !== 'undefined' ? window.innerWidth <= 768 : false;
    const handleResize = () => {
      const next = window.innerWidth <= 768;
      if (next !== lastIsMobile) {
        lastIsMobile = next;
        setIsMobile(next);
      }
    };
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const totalDuration = mode === 'work' ? 25 * 60 : 5 * 60;
  const progressPercent = ((totalDuration - timeLeft) / totalDuration) * 100;

  if (isMobile) return null;

  return (
    <div 
      ref={widgetRef} 
      style={{ 
        position: 'fixed', 
        top: '50%', 
        bottom: 'auto',
        right: '24px', 
        transform: 'translateY(-50%)', 
        zIndex: 9999 
      }}
    >
      <style>{`
        @keyframes pomodoro-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pomodoro-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.95); }
        }
        .pomodoro-icon-clean, .pomodoro-icon-clean svg, .pomodoro-icon-clean path {
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          background: none !important;
          background-color: transparent !important;
        }
      `}</style>

      {/* Popover Control Menu */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          bottom: isMobile ? '50px' : '56px',
          right: 0,
          width: isMobile ? '230px' : '240px',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border-light)',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          animation: 'slideUpFade 0.2s ease-out'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={11} className="pomodoro-icon-clean" />
              {mode === 'work' ? t('Tập trung') : t('Giải lao')}
            </span>
            <button
              onClick={() => {
                setIsOpen(false);
                setIsFocusMode(true);
              }}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--color-primary)',
                cursor: 'pointer',
                fontSize: '0.68rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '3px'
              }}
            >
              <Eye size={11} className="pomodoro-icon-clean" />
              {t('Toàn màn hình')}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '4px', background: 'var(--color-background-base)', padding: '2px', borderRadius: '8px' }}>
            <button
              onClick={() => switchMode('work')}
              style={{
                flex: 1,
                padding: '4px',
                fontSize: '0.65rem',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: mode === 'work' ? 'var(--color-surface)' : 'transparent',
                color: mode === 'work' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                boxShadow: mode === 'work' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              {t('Làm việc')}
            </button>
            <button
              onClick={() => switchMode('break')}
              style={{
                flex: 1,
                padding: '4px',
                fontSize: '0.65rem',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: mode === 'break' ? 'var(--color-surface)' : 'transparent',
                color: mode === 'break' ? '#10b981' : 'var(--color-text-muted)',
                boxShadow: mode === 'break' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              {t('Giải lao')}
            </button>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px 0',
            background: 'var(--color-bg-subtle, rgba(0,0,0,0.02))',
            borderRadius: '12px',
            border: '1px dashed var(--color-border-light)'
          }}>
            <span style={{
              fontSize: '2rem',
              fontWeight: 850,
              fontFamily: 'monospace',
              color: mode === 'work' ? 'var(--color-primary, #BD1D2D)' : '#10b981',
              letterSpacing: '-0.5px'
            }}>
              {formatTime(timeLeft)}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', alignItems: 'center', margin: '2px 0' }}>
            <button
              onClick={resetTimer}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              title={t('Đặt lại')}
            >
              <RotateCcw size={12} className="pomodoro-icon-clean" />
            </button>

            <button
              onClick={toggleTimer}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: 'none',
                background: mode === 'work' ? 'linear-gradient(135deg, #BD1D2D, #8b0000)' : 'linear-gradient(135deg, #10b981, #059669)',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
              }}
            >
              {isRunning ? <Pause size={14} fill="white" className="pomodoro-icon-clean" /> : <Play size={14} fill="white" style={{ marginLeft: '2px' }} className="pomodoro-icon-clean" />}
            </button>
          </div>

          <div style={{
            borderTop: '1px solid var(--color-border-light)',
            paddingTop: '6px',
            display: 'flex',
            justifyContent: 'center',
            fontSize: '0.65rem',
            color: 'var(--color-text-muted)',
            gap: '6px'
          }}>
            <span>{t('Hôm nay đã tập trung:')}</span>
            <span style={{ fontWeight: 850, color: 'var(--color-text)' }}>{totalSessions} {t('phiên')}</span>
          </div>
        </div>
      )}

      {/* Floating Sticky Circular Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          background: 'var(--color-surface)',
          border: 'none',
          boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          outline: 'none',
          backdropFilter: 'blur(8px)',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: isRunning ? (mode === 'work' ? 'var(--color-primary)' : '#10b981') : 'var(--color-border-light)'
        }}
        className="hover-lift"
        title={t('Pomodoro Focus')}
      >
        <svg width="44" height="44" viewBox="0 0 44 44" style={{ position: 'absolute', transform: 'rotate(-90deg)', top: -1, left: -1, border: 'none', outline: 'none', background: 'none' }}>
          <circle
            cx="22"
            cy="22"
            r="19"
            stroke="transparent"
            strokeWidth="2.5"
            fill="transparent"
          />
          <circle
            cx="22"
            cy="22"
            r="19"
            stroke={mode === 'work' ? 'var(--color-primary, #BD1D2D)' : '#10b981'}
            strokeWidth="2.5"
            fill="transparent"
            strokeDasharray={2 * Math.PI * 19}
            strokeDashoffset={2 * Math.PI * 19 * (1 - progressPercent / 100)}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s ease', border: 'none', outline: 'none' }}
          />
        </svg>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <Clock
            size={18}
            className="pomodoro-icon-clean"
            style={{
              color: mode === 'work' ? 'var(--color-primary, #BD1D2D)' : '#10b981',
              animation: isRunning ? 'pomodoro-spin 10s linear infinite' : 'none',
              border: 'none',
              outline: 'none',
              background: 'none',
              backgroundColor: 'transparent'
            }}
          />
        </div>
      </button>

      {/* Full Screen Focus Mode */}
      {isFocusMode && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.96)',
          backdropFilter: 'blur(20px)',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          animation: 'fadeIn 0.3s ease'
        }}>
          <div style={{ position: 'absolute', top: '2rem', display: 'flex', justifyContent: 'space-between', width: '80%', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={20} style={{ color: 'var(--color-primary, #BD1D2D)' }} className="pomodoro-icon-clean" />
              <span style={{ fontSize: '0.9rem', fontWeight: 800, letterSpacing: '0.1em' }}>RICH LAND FOCUS ENGINE</span>
            </div>
            <button
              onClick={() => setIsFocusMode(false)}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'white',
                padding: '6px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 700
              }}
            >
              {t('Thoát Focus Mode')}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', maxWidth: '500px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
              {mode === 'work' ? t('ĐANG TẬP TRUNG LÀM VIỆC') : t('ĐANG GIẢI LAO')}
            </span>

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="240" height="240" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)', border: 'none', outline: 'none' }}>
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="3"
                  fill="transparent"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  stroke={mode === 'work' ? 'var(--color-primary, #BD1D2D)' : '#10b981'}
                  strokeWidth="3"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 50}
                  strokeDashoffset={2 * Math.PI * 50 * (1 - progressPercent / 100)}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.5s ease', border: 'none', outline: 'none' }}
                />
              </svg>

              <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '3.5rem', fontWeight: 800, fontFamily: 'monospace', color: 'white', letterSpacing: '-1px' }}>
                  {formatTime(timeLeft)}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
              <button
                onClick={resetTimer}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <RotateCcw size={16} className="pomodoro-icon-clean" />
              </button>

              <button
                onClick={toggleTimer}
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  border: 'none',
                  background: mode === 'work' ? 'var(--color-primary, #BD1D2D)' : '#10b981',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: mode === 'work' ? '0 8px 24px rgba(189, 29, 45, 0.3)' : '0 8px 24px rgba(16, 185, 129, 0.3)'
                }}
              >
                {isRunning ? <Pause size={24} fill="white" className="pomodoro-icon-clean" /> : <Play size={24} fill="white" style={{ marginLeft: '3px' }} className="pomodoro-icon-clean" />}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
