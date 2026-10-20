import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export interface BackStackEntry {
  id: string;
  priority: number;
  openedAt: number;
  onBack: () => void;
}

const activeBackStack: BackStackEntry[] = [];
let entryCounter = 0;

export function registerMobileBackHandler(
  id: string,
  priority: number,
  onBack: () => void
): () => void {
  const existingIdx = activeBackStack.findIndex((item) => item.id === id);
  const openedAt = existingIdx >= 0 ? activeBackStack[existingIdx].openedAt : ++entryCounter;

  const entry: BackStackEntry = {
    id,
    priority,
    openedAt,
    onBack,
  };

  if (existingIdx >= 0) {
    activeBackStack[existingIdx] = entry;
  } else {
    activeBackStack.push(entry);
  }

  return () => {
    const idx = activeBackStack.findIndex((item) => item.id === id);
    if (idx >= 0) {
      activeBackStack.splice(idx, 1);
    }
  };
}

export function updateMobileBackHandlerCallback(id: string, onBack: () => void): void {
  const existing = activeBackStack.find((item) => item.id === id);
  if (existing) {
    existing.onBack = onBack;
  }
}

/**
 * Pops and invokes the highest-priority (and most recently opened) back handler.
 * Returns true if a handler was invoked.
 */
export function popTopMobileBackHandler(): boolean {
  if (activeBackStack.length === 0) return false;

  // Sort by highest priority first, then most recently opened (LIFO)
  let bestIdx = 0;
  for (let i = 1; i < activeBackStack.length; i++) {
    const cur = activeBackStack[i];
    const best = activeBackStack[bestIdx];
    if (
      cur.priority > best.priority ||
      (cur.priority === best.priority && cur.openedAt > best.openedAt)
    ) {
      bestIdx = i;
    }
  }

  const chosen = activeBackStack[bestIdx];
  if (!chosen) return false;

  try {
    chosen.onBack();
    return true;
  } catch (err) {
    console.error('[MobileBackStack] Error in onBack handler:', err);
    return false;
  }
}

/**
 * Layer 2 Safety Net: Scans the DOM for any visible modal/drawer backdrop or portal overlay
 * that might not have explicitly registered with useMobileBackHandler, and closes the topmost one.
 */
export function closeTopmostDomOverlay(): boolean {
  if (typeof document === 'undefined') return false;

  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      '.overlay-backdrop, .drawer-backdrop, .proof-modal-overlay, .stats-modal-backdrop, [class*="CustomModal_backdrop"]'
    )
  ).filter((el) => {
    if (!el.isConnected) return false;
    const style = window.getComputedStyle(el);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      parseFloat(style.opacity || '1') <= 0.01 ||
      style.pointerEvents === 'none'
    ) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });

  if (candidates.length === 0) return false;

  const getEffectiveZIndex = (el: HTMLElement): number => {
    let cur: HTMLElement | null = el;
    let maxZ = 0;
    while (cur && cur !== document.body) {
      const z = parseInt(window.getComputedStyle(cur).zIndex || '0', 10);
      if (!Number.isNaN(z) && z > maxZ) {
        maxZ = z;
      }
      cur = cur.parentElement;
    }
    return maxZ;
  };

  let topBackdrop = candidates[candidates.length - 1];
  let topZ = getEffectiveZIndex(topBackdrop);

  for (let i = 0; i < candidates.length; i++) {
    const z = getEffectiveZIndex(candidates[i]);
    if (z >= topZ) {
      topZ = z;
      topBackdrop = candidates[i];
    }
  }

  // Try finding an explicit close/cancel button inside the modal/drawer container first
  const container = topBackdrop.parentElement || topBackdrop;
  const closeBtn = container.querySelector<HTMLElement>(
    'button[aria-label="Close"], [class*="closeBtn"], .close-btn, button[title="Đóng"], button[title="Thoát"]'
  );
  if (closeBtn) {
    closeBtn.click();
    return true;
  }

  // Or look for a header button with an X icon (lucide-x) inside the overlay
  const xIcon = container.querySelector('svg.lucide-x, svg.lucide-x-circle');
  const xBtn = xIcon?.closest('button') as HTMLElement | null;
  if (xBtn) {
    xBtn.click();
    return true;
  }

  // Fallback: click the backdrop itself
  topBackdrop.click();
  return true;
}

/**
 * React Hook to bind any Modal, Drawer, Sheet, Lightbox, Dropdown, or Sub-view
 * to the Global Mobile Back Stack.
 */
export function useMobileBackHandler(
  isOpen: boolean,
  onBack: () => void,
  priority = 300,
  customId?: string
): void {
  const idRef = useRef<string>(
    customId || `mbh_${Math.random().toString(36).slice(2, 10)}_${++entryCounter}`
  );
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!isOpen) return;
    const unregister = registerMobileBackHandler(idRef.current, priority, () => {
      onBackRef.current();
    });
    return unregister;
  }, [isOpen, priority]);
}

/**
 * Global Mobile Back Sentinel & In-App History Controller.
 * Prevents the browser Back button / edge-swipe gesture from exiting the PWA/WebApp,
 * and routes Back actions strictly through:
 *   1. Open Modals / Drawers / Sub-tabs (LIFO Stack)
 *   2. Any visible DOM Overlay / Backdrop (Safety Net)
 *   3. Previous In-App Route History
 *   4. Role Home Screen (/workspace or /dashboard) without ever exiting the app
 */
export const MobileBackSentinel: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const routeHistoryRef = useRef<string[]>([]);
  const isInternalBackNavRef = useRef<boolean>(false);
  const userRoleRef = useRef<string>('');
  userRoleRef.current = String(user?.role || '').toLowerCase();

  const pushSentinel = () => {
    if (typeof window === 'undefined') return;
    try {
      const currentState = window.history.state || {};
      if (!currentState.__richlandSentinel) {
        window.history.pushState(
          { ...currentState, __richlandSentinel: true, __ts: Date.now() },
          '',
          window.location.href
        );
      }
    } catch (_) {}
  };

  // Track route changes in our in-app route stack & keep sentinel armed
  useEffect(() => {
    const fullPath = location.pathname + location.search;

    // Ignore pure intermediate redirect routes
    const isSale = ['sale', 'sales'].includes(userRoleRef.current);
    const isPureRedirect =
      (location.pathname === '/' && isSale) ||
      (location.pathname === '/data' && isSale) ||
      location.pathname === '/activities';

    if (!isPureRedirect) {
      if (isInternalBackNavRef.current) {
        isInternalBackNavRef.current = false;
      } else {
        const stack = routeHistoryRef.current;
        if (stack.length === 0 || stack[stack.length - 1] !== fullPath) {
          stack.push(fullPath);
          if (stack.length > 25) {
            stack.shift();
          }
        }
      }
    }

    // Always ensure sentinel state sits on top of the current URL entry
    pushSentinel();
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Push an extra base anchor + sentinel on initial mount so rapid double-swipes never exit the app
    try {
      window.history.pushState(
        { ...(window.history.state || {}), __richlandBaseAnchor: true },
        '',
        window.location.href
      );
      window.history.pushState(
        { ...(window.history.state || {}), __richlandSentinel: true },
        '',
        window.location.href
      );
    } catch (_) {}

    const handlePopState = (e: PopStateEvent) => {
      // Stop React Router from reacting to the raw browser popstate
      e.stopImmediatePropagation();

      // Immediately re-arm the sentinel on the current URL so the user can never fall out of the app
      try {
        window.history.pushState(
          { ...(window.history.state || {}), __richlandSentinel: true, __ts: Date.now() },
          '',
          window.location.href
        );
      } catch (_) {}

      // Layer 1: Explicit LIFO Back Stack (Modals, Sheets, Drawers, Sub-tabs, Mobile Menus)
      if (popTopMobileBackHandler()) {
        return;
      }

      // Layer 2: DOM Overlay / Portal Safety Net
      if (closeTopmostDomOverlay()) {
        return;
      }

      // Layer 3: In-App Route History Stack
      const stack = routeHistoryRef.current;
      const currentFullPath = window.location.pathname + window.location.search;

      // Remove any trailing entries matching current path
      while (stack.length > 0 && stack[stack.length - 1] === currentFullPath) {
        stack.pop();
      }

      if (stack.length > 0) {
        const prevRoute = stack[stack.length - 1];
        if (prevRoute && prevRoute !== currentFullPath) {
          isInternalBackNavRef.current = true;
          navigate(prevRoute, { replace: true });
          return;
        }
      }

      // Layer 4: Root Home Fallback (Stay in App at Role's Home Screen)
      const currentPathname = window.location.pathname;
      if (currentPathname === '/login' || currentPathname === '/report-data' || currentPathname === '/download') {
        return;
      }

      const isSale = ['sale', 'sales'].includes(userRoleRef.current);
      const defaultHome = isSale ? '/workspace' : '/dashboard';

      if (currentPathname !== defaultHome && !(currentPathname === '/' && !isSale)) {
        routeHistoryRef.current = [defaultHome];
        isInternalBackNavRef.current = true;
        navigate(defaultHome, { replace: true });
      }
    };

    // Register in capture phase so we intercept before React Router's bubble listener
    window.addEventListener('popstate', handlePopState, true);
    return () => {
      window.removeEventListener('popstate', handlePopState, true);
    };
  }, [navigate]);

  return null;
};
