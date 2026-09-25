import React, { useEffect, useState, useRef } from 'react';
import { RefreshCw, Sparkles, X, Clock } from 'lucide-react';
import { playNotificationChime } from '../utils/soundHelper';

interface VersionInfo {
  version: string;
  buildTime?: string;
}

declare const __APP_VERSION__: string | undefined;

export const AutoUpdateChecker: React.FC = () => {
  // Check if running on localhost / dev environment
  const isDevOrLocalhost = 
    typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.local') ||
      Boolean(import.meta.env.DEV)
    );

  const [hasNewVersion, setHasNewVersion] = useState(false);
  const [newVersion, setNewVersion] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(10);
  const [isSnoozed, setIsSnoozed] = useState(false);

  // Store loaded client version
  const initialVersionRef = useRef<string>(
    typeof __APP_VERSION__ !== 'undefined' ? String(__APP_VERSION__).trim() : ''
  );
  const isCheckingRef = useRef(false);

  // Trigger update modal with strong loop prevention
  const triggerUpdate = (serverVer: string) => {
    if (!serverVer || serverVer === initialVersionRef.current) return;

    // Check if this version was already reloaded recently (prevent infinite reload loops)
    try {
      const reloadKey = `richland_reload_${serverVer}`;
      const lastReloadTimestamp = localStorage.getItem(reloadKey);
      if (lastReloadTimestamp) {
        const elapsedMinutes = (Date.now() - Number(lastReloadTimestamp)) / (1000 * 60);
        // If reloaded within the last 30 minutes for this exact version, do not prompt or loop again
        if (elapsedMinutes < 30) {
          return;
        }
      }

      // Check session snooze
      const snoozeUntil = sessionStorage.getItem('richland_update_snooze_until');
      if (snoozeUntil && Date.now() < Number(snoozeUntil)) {
        return;
      }
    } catch {
      // Ignore storage errors in restricted mode
    }

    // If tab is currently hidden/background, reload silently once
    if (document.hidden) {
      try {
        localStorage.setItem(`richland_reload_${serverVer}`, String(Date.now()));
      } catch {}
      window.location.reload();
      return;
    }

    // Play subtle bell chime to alert user of new update
    playNotificationChime();
    setNewVersion(serverVer);
    setHasNewVersion(true);
  };

  // Check version against /version.json
  const checkVersion = async () => {
    if (isDevOrLocalhost) return;
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;

    try {
      const res = await fetch(`/version.json?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      if (!res.ok) {
        isCheckingRef.current = false;
        return;
      }

      const text = await res.text();
      let serverVer = '';
      try {
        const data: VersionInfo = JSON.parse(text);
        serverVer = String(data?.version || '').trim();
      } catch {
        // Fallback regex in case JSON was unquoted
        const match = text.match(/version\s*:\s*["']?([a-zA-Z0-9_-]+)["']?/);
        if (match) {
          serverVer = match[1].trim();
        }
      }

      if (!serverVer) {
        isCheckingRef.current = false;
        return;
      }

      // If initial version is not yet recorded, seed it
      if (!initialVersionRef.current) {
        initialVersionRef.current = serverVer;
        isCheckingRef.current = false;
        return;
      }

      // If versions differ, trigger update
      if (serverVer !== initialVersionRef.current) {
        triggerUpdate(serverVer);
      }
    } catch {
      // Ignore network errors during background check
    } finally {
      isCheckingRef.current = false;
    }
  };

  // 1. Initial version probe and periodic interval check
  useEffect(() => {
    if (isDevOrLocalhost) return;

    checkVersion();

    // Check every 2 minutes
    const interval = setInterval(() => {
      checkVersion();
    }, 120000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };

    const handleFocus = () => {
      checkVersion();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isDevOrLocalhost]);

  // 2. Countdown timer when update dialog is visible
  useEffect(() => {
    if (!hasNewVersion || isSnoozed || isDevOrLocalhost) return;

    if (countdown <= 0) {
      handleReload();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [hasNewVersion, isSnoozed, countdown, isDevOrLocalhost]);

  const handleReload = () => {
    if (newVersion) {
      try {
        localStorage.setItem(`richland_reload_${newVersion}`, String(Date.now()));
      } catch {}
    }
    window.location.reload();
  };

  const handleSnooze = (durationMinutes = 60) => {
    setIsSnoozed(true);
    setHasNewVersion(false);
    try {
      sessionStorage.setItem('richland_update_snooze_until', String(Date.now() + durationMinutes * 60 * 1000));
    } catch {}
  };

  // Disable completely on localhost/dev or if nothing to update
  if (isDevOrLocalhost || !hasNewVersion || isSnoozed) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999999,
        maxWidth: '380px',
        width: 'calc(100vw - 40px)',
        pointerEvents: 'auto',
        animation: 'notifToastSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards'
      }}
    >
      <div
        style={{
          background: 'var(--color-surface, #ffffff)',
          borderRadius: '16px',
          border: '1px solid var(--color-border, #e2e8f0)',
          boxShadow: '0 20px 40px -8px rgba(0, 0, 0, 0.25), 0 4px 16px rgba(0, 0, 0, 0.08)',
          padding: '16px 18px 18px 18px',
          position: 'relative',
          overflow: 'hidden',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)'
        }}
      >
        {/* Animated Progress Bar at bottom */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: '3px',
            background: 'linear-gradient(90deg, var(--color-primary, #BD1D2D), #f59e0b)',
            width: `${(countdown / 10) * 100}%`,
            transition: 'width 1s linear'
          }}
        />

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          {/* Brand Icon Box */}
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'rgba(189, 29, 45, 0.1)',
              border: '1px solid rgba(189, 29, 45, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: 'var(--color-primary, #BD1D2D)'
            }}
          >
            <RefreshCw
              size={20}
              style={{
                animation: 'spin 3s linear infinite'
              }}
            />
          </div>

          {/* Content Area */}
          <div style={{ flex: 1, minWidth: 0, paddingRight: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <Sparkles size={15} color="#f59e0b" />
              <h4
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  color: 'var(--color-text, #0f172a)',
                  margin: 0,
                  letterSpacing: '-0.2px'
                }}
              >
                Cập nhật hệ thống mới
              </h4>
            </div>

            <p
              style={{
                fontSize: '0.78rem',
                color: 'var(--color-text-muted, #475569)',
                lineHeight: 1.45,
                margin: '0 0 12px 0'
              }}
            >
              Hệ thống đã nâng cấp phiên bản mới. Tự động làm mới sau{' '}
              <span
                style={{
                  fontWeight: 700,
                  color: 'var(--color-primary, #BD1D2D)',
                  background: 'rgba(189, 29, 45, 0.1)',
                  padding: '1px 6px',
                  borderRadius: '6px',
                  display: 'inline-block'
                }}
              >
                {countdown}s
              </span>
            </p>

            {/* Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleReload}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  background: 'var(--color-primary, #BD1D2D)',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(189, 29, 45, 0.35)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(189, 29, 45, 0.45)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(189, 29, 45, 0.35)';
                }}
              >
                <RefreshCw size={13} />
                Làm mới ngay
              </button>

              <button
                type="button"
                onClick={() => handleSnooze(60)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: 'var(--color-bg, #f1f5f9)',
                  color: 'var(--color-text-muted, #475569)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  border: '1px solid var(--color-border, #cbd5e1)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.filter = 'brightness(0.95)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = 'none';
                }}
              >
                <Clock size={13} />
                Để sau
              </button>
            </div>
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={() => handleSnooze(60)}
            title="Đóng thông báo"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-muted, #94a3b8)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
              flexShrink: 0
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AutoUpdateChecker;
