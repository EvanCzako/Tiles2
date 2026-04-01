import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { HEADER_H, LANDSCAPE_PANEL_W } from '../constants';

export function computeScale(containerW, containerH) {
  const vw = window.visualViewport?.width  ?? document.documentElement.clientWidth;
  const vh = window.visualViewport?.height ?? document.documentElement.clientHeight;
  const landscape = vw > vh;
  const availW = vw - 32 - (landscape ? LANDSCAPE_PANEL_W * 2 : 0);
  const availH = vh - (landscape ? 32 : HEADER_H);
  return Math.max(0.28, Math.min(1, availW / containerW, availH / containerH));
}

export function useScale(containerW, containerH) {
  const [scale, setScale] = useState(() =>
    typeof document === 'undefined' ? 1 : computeScale(containerW, containerH)
  );

  // Use a ref to avoid stale closures in the resize observer callback
  const dimsRef = useRef({ containerW, containerH });
  dimsRef.current = { containerW, containerH };

  // Recalculate when grid dimensions change (e.g. mode switch)
  useEffect(() => {
    setScale(computeScale(containerW, containerH));
  }, [containerW, containerH]);

  // Recalculate on viewport resize / orientation change
  useLayoutEffect(() => {
    let rafId = null;
    const update = () => {
      const vh = window.visualViewport?.height ?? document.documentElement.clientHeight;
      document.documentElement.style.setProperty('--app-h', `${vh}px`);
      const { containerW: cW, containerH: cH } = dimsRef.current;
      setScale(computeScale(cW, cH));
    };
    const defer = () => { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(update); };

    let orientationTimer = null;
    const onOrientation = () => {
      clearTimeout(orientationTimer);
      orientationTimer = setTimeout(update, 150);
    };

    const ro = new ResizeObserver(defer);
    ro.observe(document.documentElement);
    window.addEventListener('resize', defer);
    window.visualViewport?.addEventListener('resize', defer);
    window.addEventListener('orientationchange', onOrientation);
    update();

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(orientationTimer);
      ro.disconnect();
      window.removeEventListener('resize', defer);
      window.visualViewport?.removeEventListener('resize', defer);
      window.removeEventListener('orientationchange', onOrientation);
    };
  }, []);

  return scale;
}
