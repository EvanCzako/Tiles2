// ── Reduced motion ───────────────────────────────────────────────────────────
// The OS-level "reduce motion" preference (System Settings → Accessibility on
// macOS/iOS, "Show animations" on Windows/Android) is the default; Settings lets
// the player override it either way.
//
// What it turns off is *decorative* motion only — screen shake, the nuke-meter
// pulse, the floating score popups' drift, the announcement's scale-pop and the
// combo badge's bounce. Tile flight and collapse motion stay: they are how the
// player reads what the board did, and the cascade's setTimeout chain is timed
// against ANIM_MS, so suppressing them would desynchronise the animation from
// the state commits rather than merely calming the screen. This matches the
// intent of WCAG 2.3.3 / Apple's Reduce Motion (remove non-essential motion),
// and screen shake is the actual vestibular trigger here.

const QUERY = '(prefers-reduced-motion: reduce)';

function mql(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  try {
    return window.matchMedia(QUERY);
  } catch {
    return null;
  }
}

/** The OS preference right now (false when unsupported/unavailable). */
export function systemPrefersReducedMotion(): boolean {
  return mql()?.matches ?? false;
}

/**
 * Subscribe to OS-level changes. Returns an unsubscribe fn. Used to keep the
 * app in step when the player flips the system toggle mid-session without
 * having set an explicit in-app override.
 */
export function onSystemMotionChange(cb: (reduced: boolean) => void): () => void {
  const m = mql();
  if (!m) return () => {};
  const handler = (e: MediaQueryListEvent) => cb(e.matches);
  // Safari < 14 only has the deprecated add/removeListener pair.
  if (typeof m.addEventListener === 'function') {
    m.addEventListener('change', handler);
    return () => m.removeEventListener('change', handler);
  }
  const legacy = m as unknown as {
    addListener?: (h: (e: MediaQueryListEvent) => void) => void;
    removeListener?: (h: (e: MediaQueryListEvent) => void) => void;
  };
  legacy.addListener?.(handler);
  return () => legacy.removeListener?.(handler);
}
