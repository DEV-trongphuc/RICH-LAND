import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

console.log('%cPower by Turniodev (https://fb.com/turni0)', 'color: red; font-weight: bold; font-size: 14px;');

let splashStartTime = Date.now();
let hideTimer: any = null;

// Smoothly show the instant Mascot Splash Screen (e.g. after login click)
export const showSplashScreen = (statusText: string = 'Đang tải dữ liệu...') => {
  splashStartTime = Date.now();
  if (hideTimer) clearTimeout(hideTimer);
  document.documentElement.classList.remove('hide-initial-splash');
  const splash = document.getElementById('richland-splash-screen');
  if (splash) {
    splash.classList.remove('splash-fade-out');
    splash.style.display = 'flex';
    splash.style.opacity = '1';
    splash.style.visibility = 'visible';
    splash.style.pointerEvents = 'auto';
    const statusEl = splash.querySelector('.splash-status-text .status-msg');
    if (statusEl) {
      statusEl.textContent = statusText;
    }
  }
};

// Smoothly dismiss the instant Mascot Splash Screen (min 3.0 seconds display time)
export const hideSplashScreen = (force: boolean = false) => {
  const doHide = () => {
    const splash = document.getElementById('richland-splash-screen');
    if (splash && !splash.classList.contains('splash-fade-out')) {
      splash.classList.add('splash-fade-out');
      // Dispatch event so layout popups can appear cleanly after splash is gone
      window.dispatchEvent(new CustomEvent('splash-dismissed'));
      setTimeout(() => {
        splash.style.display = 'none';
      }, 550);
    }
  };

  if (force) {
    if (hideTimer) clearTimeout(hideTimer);
    doHide();
    return;
  }

  const elapsed = Date.now() - splashStartTime;
  const MIN_SPLASH_DURATION = 3000; // Minimum 3.0 seconds as requested
  const remaining = Math.max(0, MIN_SPLASH_DURATION - elapsed);

  if (hideTimer) clearTimeout(hideTimer);
  if (remaining > 0) {
    hideTimer = setTimeout(doHide, remaining);
  } else {
    doHide();
  }
};

(window as any).showSplashScreen = showSplashScreen;
(window as any).hideSplashScreen = hideSplashScreen;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Safety fallback timeout (6s) in case of unexpected network failure
setTimeout(() => {
  if (typeof (window as any).hideSplashScreen === 'function') {
    (window as any).hideSplashScreen();
  }
}, 6000);
