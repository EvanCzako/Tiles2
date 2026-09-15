import { useState, useLayoutEffect } from 'react';
import { HEADER_H } from '../constants';

interface Viewport {
  vw: number;
  vh: number;
}

function readViewport(): Viewport {
  return {
    vw: window.visualViewport?.width ?? document.documentElement.clientWidth,
    vh: window.visualViewport?.height ?? document.documentElement.clientHeight,
  };
}

function scaleFor(vp: Viewport, containerW: number, containerH: number): number {
  return Math.max(0.28, Math.min(1, (vp.vw - 32) / containerW, (vp.vh - HEADER_H) / containerH));
}

export function computeScale(containerW: number, containerH: number): number {
  return scaleFor(readViewport(), containerW, containerH);
}

export function useScale(containerW: number, containerH: number): number {
  const hasDom = typeof document !== 'undefined';

  // The viewport is the only external input; the scale is *derived* from it during
  // render. Keeping it derived (rather than a second piece of state synced by an
  // effect) means a board-size change resizes on the same render that changes it —
  // no one-frame flash at the old scale — and there is no stale-closure ref to keep
  // in step with the resize subscription below.
  const [vp, setVp] = useState<Viewport>(() => (hasDom ? readViewport() : { vw: 0, vh: 0 }));

  useLayoutEffect(() => {
    let rafId: number | null = null;
    const update = () => {
      const next = readViewport();
      document.documentElement.style.setProperty('--app-h', `${next.vh}px`);
      setVp((prev) => (prev.vw === next.vw && prev.vh === next.vh ? prev : next));
    };
    const defer = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    };

    let orientationTimer: ReturnType<typeof setTimeout> | null = null;
    const onOrientation = () => {
      if (orientationTimer !== null) clearTimeout(orientationTimer);
      orientationTimer = setTimeout(update, 150);
    };

    const ro = new ResizeObserver(defer);
    ro.observe(document.documentElement);
    window.addEventListener('resize', defer);
    window.visualViewport?.addEventListener('resize', defer);
    window.addEventListener('orientationchange', onOrientation);
    // Prime the CSS var before first paint. No setState here — the initial state
    // above already read the viewport, and ResizeObserver fires once on observe.
    document.documentElement.style.setProperty('--app-h', `${readViewport().vh}px`);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (orientationTimer !== null) clearTimeout(orientationTimer);
      ro.disconnect();
      window.removeEventListener('resize', defer);
      window.visualViewport?.removeEventListener('resize', defer);
      window.removeEventListener('orientationchange', onOrientation);
    };
  }, []);

  return hasDom ? scaleFor(vp, containerW, containerH) : 1;
}
