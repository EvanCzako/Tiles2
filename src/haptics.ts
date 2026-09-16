// ── Haptics ──────────────────────────────────────────────────────────────────
// Progressive enhancement over the Vibration API: supported on Android Chrome
// and Firefox, absent on iOS Safari (Apple exposes no web vibration API), so
// every call is a no-op there rather than an error. The RN port will swap this
// module's body for expo-haptics and keep the same call sites.
//
// Patterns are deliberately short — a game that buzzes on every cascade wave
// drains the battery and stops meaning anything.

let enabled = true;

export function setHapticsEnabled(on: boolean): void {
  enabled = on;
}

/**
 * Whether this browser can vibrate at all. Settings uses it to hide the haptics
 * switch on platforms where it could never do anything (iOS Safari), instead of
 * offering a control that silently no-ops.
 */
export function hapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

function buzz(pattern: number | number[]): void {
  if (!enabled || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* some embedded webviews expose the method but throw on use */
  }
}

/** A push landed. The lightest tick there is — it fires every turn. */
export function hapticPush(): void {
  buzz(8);
}

/**
 * An annihilation wave resolved. Scales with the combo multiplier so a long
 * cascade builds, capped so it never turns into a continuous rumble.
 */
export function hapticMatch(combo: number): void {
  buzz(Math.min(10 + combo * 4, 40));
}

/** A 3+ group swept its value off the whole board. */
export function hapticBoardWipe(): void {
  buzz([0, 30, 40, 30]);
}

/** Nuke detonation — the heaviest event in the game. */
export function hapticNuke(): void {
  buzz([0, 60, 50, 90]);
}

/** The play area was emptied. */
export function hapticCleanSweep(): void {
  buzz([0, 25, 35, 25, 35, 60]);
}

/** Run over. */
export function hapticGameOver(): void {
  buzz([0, 80, 60, 140]);
}
