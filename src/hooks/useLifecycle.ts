import { useEffect } from 'react';
import useGameStore from '../store';
import { suspendAudio } from '../sound';

// ── Page lifecycle ───────────────────────────────────────────────────────────
// The browser counterpart of a native app's background/foreground handling.
// Two jobs:
//
//  1. Snapshot the run. A tab can be hidden and then discarded by the browser
//     to reclaim memory — on mobile especially — with no further callbacks, so
//     "hidden" is the last reliable moment to write state. `pagehide` covers the
//     reload/close path (`beforeunload` is unreliable on iOS and blocks the
//     bfcache, so it is deliberately not used).
//  2. Release the audio hardware while hidden; ac() resumes the context lazily
//     on the next sound, so nothing else needs to know.
//
// Mounted once, at the app root, so a run is protected on every screen — the
// player can be sitting on the menu mid-game when the tab is reclaimed.
export function useLifecycle(): void {
  useEffect(() => {
    const snapshot = () => {
      // Read the action off the store directly: this listener outlives any one
      // render, and the action identity is stable for the store's lifetime.
      useGameStore.getState().persistRun();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        snapshot();
        suspendAudio();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', snapshot);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', snapshot);
    };
  }, []);
}
