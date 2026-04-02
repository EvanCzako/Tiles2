import { useEffect, useCallback, useRef } from 'react';

export function useInput(triggerPush) {
  const touchStart = useRef(null);

  // ── Keyboard ──────────────────────────────────────────────────────────────
  const handleKey = useCallback(
    (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        triggerPush('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        triggerPush('right');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        triggerPush('down');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        triggerPush('up');
      }
    },
    [triggerPush]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  // ── Touch / swipe ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onStart = (e) => {
      touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onEnd = (e) => {
      if (!touchStart.current) return;
      const dx = e.changedTouches[0].clientX - touchStart.current.x;
      const dy = e.changedTouches[0].clientY - touchStart.current.y;
      touchStart.current = null;
      if (Math.abs(dx) < 30 && Math.abs(dy) < 30) return;
      if (Math.abs(dx) >= Math.abs(dy)) triggerPush(dx < 0 ? 'left' : 'right');
      else triggerPush(dy > 0 ? 'down' : 'up');
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchend', onEnd);
    };
  }, [triggerPush]);
}
