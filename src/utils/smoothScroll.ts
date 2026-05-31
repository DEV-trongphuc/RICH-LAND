// Premium momentum smooth scrolling for traditional mouse wheels
// Respects trackpads and smooth-scrolling mice by bypassing them

interface ScrollState {
  target: number;
  current: number;
  animating: boolean;
}

const scrollContainers = new Map<HTMLElement, ScrollState>();

function findScrollableParent(el: HTMLElement | null, deltaY: number): HTMLElement | null {
  while (el && el !== document.body && el !== document.documentElement) {
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY || style.overflow || '';
    const isScrollable = overflowY === 'auto' || overflowY === 'scroll';

    if (isScrollable && el.scrollHeight > el.clientHeight) {
      const canScrollDown = deltaY > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1;
      const canScrollUp = deltaY < 0 && el.scrollTop > 1;
      if (canScrollDown || canScrollUp) {
        return el;
      }
    }
    el = el.parentElement;
  }

  // Fallback to documentElement
  const docEl = document.documentElement;
  if (docEl.scrollHeight > docEl.clientHeight) {
    const canScrollDown = deltaY > 0 && window.scrollY + window.innerHeight < docEl.scrollHeight - 1;
    const canScrollUp = deltaY < 0 && window.scrollY > 1;
    if (canScrollDown || canScrollUp) {
      return docEl;
    }
  }
  return null;
}

export function initSmoothScroll() {
  if (typeof window === 'undefined') return;

  // Intercept wheel event
  window.addEventListener('wheel', (e) => {
    // Detect trackpads and smooth wheel mice (Precision trackpads use float values or have horizontal movement)
    const isTrackpad = e.deltaX !== 0 || (e.deltaY !== 0 && (e.deltaY % 1 !== 0 || Math.abs(e.deltaY) < 15));
    if (isTrackpad) {
      return; // Let native trackpad inertia handle it
    }

    const container = findScrollableParent(e.target as HTMLElement, e.deltaY);
    if (!container) return;

    e.preventDefault();

    let state = scrollContainers.get(container);
    if (!state) {
      state = {
        target: container.scrollTop,
        current: container.scrollTop,
        animating: false
      };
      scrollContainers.set(container, state);
    }

    // Accumulate target scroll (scroll speed multiplier can be customized, 1.2 makes it feel responsive)
    const maxScroll = container.scrollHeight - container.clientHeight;
    state.target = Math.max(0, Math.min(maxScroll, state.target + e.deltaY * 1.1));

    if (!state.animating) {
      state.animating = true;

      const animate = () => {
        const s = scrollContainers.get(container);
        if (!s) return;

        // Linear interpolation (lerp) easing factor
        // 0.075 is a sweet spot for premium, smooth decelerating momentum scrolling
        s.current += (s.target - s.current) * 0.075;

        container.scrollTop = Math.round(s.current);

        if (Math.abs(s.target - s.current) > 0.5) {
          requestAnimationFrame(animate);
        } else {
          s.current = s.target;
          container.scrollTop = s.target;
          s.animating = false;
        }
      };

      requestAnimationFrame(animate);
    }
  }, { passive: false });

  // Sync state if scrolled by dragging scrollbar or programmatic scroll
  document.addEventListener('scroll', (e) => {
    const target = e.target;
    if (!target || !(target instanceof HTMLElement)) {
      const docEl = document.documentElement;
      const state = scrollContainers.get(docEl);
      if (state && !state.animating) {
        state.current = window.scrollY;
        state.target = window.scrollY;
      }
      return;
    }

    const state = scrollContainers.get(target);
    if (state && !state.animating) {
      state.current = target.scrollTop;
      state.target = target.scrollTop;
    }
  }, { capture: true, passive: true });
}
