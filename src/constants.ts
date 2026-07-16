// ── Fixed layout constants ───────────────────────────────────────────────────
export const CELL = 52;
export const GAP = 4;

// ── Animation timings ────────────────────────────────────────────────────────
export const ANIM_MS = 220;
export const FLASH_MS = 320;

// ── Juice timings ────────────────────────────────────────────────────────────
export const POPUP_MS = 900; // floating "+N" score popup lifetime
export const SHAKE_MS = 450; // screen shake duration (matches longest CSS keyframe)
export const ANNOUNCE_MS = 1000; // "ALL 5s!" / "NUKE!" banner lifetime

// ── App-level layout constants ───────────────────────────────────────────────
// Combined height of the top bar + combo strip below it (used by useScale).
export const HEADER_H = 92;

// Combo multiplier color ramp (one entry per combo level, 1..MAX_COMBO):
// grey → yellow → orange → red-orange → red → magenta → purple → white-hot.
// Index by min(combo, COMBO_COLORS.length) - 1. Shared by the combo badge and score popups.
export const COMBO_COLORS = ['#8888aa', '#ffcc00', '#ff8822', '#ff4422', '#dd1144', '#cc1188', '#9b2fd6', '#f0f0ff'];
