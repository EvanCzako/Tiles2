import type { PaletteId, GridMode, SavedRun, LifetimeStats, StatsByBoard } from '../types';
import { PALETTE_IDS, GRID_CONFIGS } from '../game';
import { systemPrefersReducedMotion } from '../motion';

const SCORES_KEY = 'tilesHighScores';
const PALETTE_KEY = 'tilesColorPalette';
const SOUND_KEY = 'tilesSoundOn';
const GRID_MODE_KEY = 'tilesGridMode';
const HAPTICS_KEY = 'tilesHapticsOn';
const REDUCED_MOTION_KEY = 'tilesReducedMotion';
const RUN_KEY = 'tilesSavedRun';
// New key: the old 'tilesLifetimeStats' held a single pooled record with no way
// to tell which board each game was played on, so it is not migrated (and is
// left in place rather than deleted).
const STATS_KEY = 'tilesLifetimeStatsByBoard';

// localStorage is not always usable: Safari private browsing, "block all cookies",
// embedded webviews and storage-quota exhaustion all make getItem/setItem *throw*
// rather than return null. These run on the game-over path (saveHighScore) and at
// module scope (loadSoundOn in store/index.ts), so an unguarded throw would take
// the whole app down. Persistence is a nice-to-have — degrade to in-memory instead.
function readItem(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeItem(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable or full — the session still plays, it just won't persist */
  }
}

function removeItem(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* same degradation as writeItem */
  }
}

export function loadHighScores(): Record<string, number> {
  const saved = readItem(SCORES_KEY);
  if (!saved) return {};
  try {
    const parsed = JSON.parse(saved) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function loadHighScore(mode: GridMode): number {
  const score = loadHighScores()[mode];
  return typeof score === 'number' && Number.isFinite(score) ? score : 0;
}

export function saveHighScore(mode: GridMode, score: number): void {
  const scores = loadHighScores();
  scores[mode] = score;
  writeItem(SCORES_KEY, JSON.stringify(scores));
}

export function loadGridMode(): GridMode {
  const saved = readItem(GRID_MODE_KEY);
  return saved && saved in GRID_CONFIGS ? (saved as GridMode) : '9x9';
}

export function saveGridMode(mode: GridMode): void {
  writeItem(GRID_MODE_KEY, mode);
}

export function loadColorPalette(): PaletteId {
  const saved = readItem(PALETTE_KEY) as PaletteId | null;
  return saved && PALETTE_IDS.includes(saved) ? saved : 'default';
}

export function saveColorPalette(id: PaletteId): void {
  writeItem(PALETTE_KEY, id);
}

export function loadSoundOn(): boolean {
  return readItem(SOUND_KEY) !== 'false';
}

export function saveSoundOn(on: boolean): void {
  writeItem(SOUND_KEY, String(on));
}

export function loadHapticsOn(): boolean {
  return readItem(HAPTICS_KEY) !== 'false';
}

export function saveHapticsOn(on: boolean): void {
  writeItem(HAPTICS_KEY, String(on));
}

// Reduced motion: the OS preference is the default, and an explicit in-app
// choice ('true'/'false') overrides it. Anything else (unset, corrupt) falls
// back to the system query so the accessible default wins.
export function loadReducedMotion(): boolean {
  const saved = readItem(REDUCED_MOTION_KEY);
  if (saved === 'true') return true;
  if (saved === 'false') return false;
  return systemPrefersReducedMotion();
}

export function saveReducedMotion(on: boolean): void {
  writeItem(REDUCED_MOTION_KEY, String(on));
}

export function clearReducedMotionOverride(): void {
  removeItem(REDUCED_MOTION_KEY);
}

export function hasReducedMotionOverride(): boolean {
  const saved = readItem(REDUCED_MOTION_KEY);
  return saved === 'true' || saved === 'false';
}

// ── In-progress run ──────────────────────────────────────────────────────────
// A run is 100+ pushes long, so losing one to a reload, a backgrounded tab the
// browser reclaimed, or a stray navigation is the difference between "I'll play
// again" and "I'm done". Only the pure game state is stored: animation sets,
// flying tiles and layout are all transient and are rebuilt on resume.

const RUN_VERSION = 1;

function isIntGrid(v: unknown, rows: number, cols: number): v is number[][] {
  return (
    Array.isArray(v) &&
    v.length === rows &&
    v.every((row) => Array.isArray(row) && row.length === cols && row.every((n) => typeof n === 'number' && Number.isFinite(n)))
  );
}

function isNumberArray(v: unknown, len: number): v is number[] {
  return Array.isArray(v) && v.length === len && v.every((n) => typeof n === 'number' && Number.isFinite(n));
}

export function saveRun(run: SavedRun): void {
  writeItem(RUN_KEY, JSON.stringify({ ...run, version: RUN_VERSION }));
}

export function clearRun(): void {
  removeItem(RUN_KEY);
}

/**
 * Returns the saved run only if it is fully consistent with the board config it
 * claims — a grid whose dimensions disagree with its mode is exactly the state
 * that used to throw on the next push (see the run guard in store/animations.ts),
 * so a mismatched or truncated save is discarded rather than loaded.
 */
export function loadRun(): SavedRun | null {
  const raw = readItem(RUN_KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (p.version !== RUN_VERSION) return null;
    const mode = p.gridMode;
    if (typeof mode !== 'string' || !(mode in GRID_CONFIGS)) return null;
    const cfg = GRID_CONFIGS[mode as GridMode];
    if (!isIntGrid(p.grid, cfg.ROWS, cfg.COLS)) return null;
    const pend = (k: string) => (isNumberArray(p[k], cfg.PENDING_SIZE) ? (p[k] as number[]) : null);
    const left = pend('leftPending'), right = pend('rightPending');
    const top = pend('topPending'), bottom = pend('bottomPending');
    if (!left || !right || !top || !bottom) return null;
    const num = (v: unknown, fallback: number) =>
      typeof v === 'number' && Number.isFinite(v) ? v : fallback;
    return {
      gridMode: mode as GridMode,
      grid: p.grid,
      leftPending: left,
      rightPending: right,
      topPending: top,
      bottomPending: bottom,
      score: Math.max(0, num(p.score, 0)),
      turnCount: Math.max(0, num(p.turnCount, 0)),
      nukeCharge: Math.max(0, num(p.nukeCharge, 0)),
      nukeArmed: p.nukeArmed === true,
      lastVerticalSide: p.lastVerticalSide === 'bottom' ? 'bottom' : 'top',
      lastHorizontalSide: p.lastHorizontalSide === 'right' ? 'right' : 'left',
    };
  } catch {
    return null;
  }
}

// ── Lifetime stats ───────────────────────────────────────────────────────────

export const EMPTY_STATS: LifetimeStats = {
  gamesPlayed: 0,
  totalScore: 0,
  totalTurns: 0,
  longestRun: 0,
  bestCombo: 0,
  tilesCleared: 0,
  boardWipes: 0,
  nukesFired: 0,
  cleanSweeps: 0,
};

export function emptyStatsByBoard(): StatsByBoard {
  return Object.fromEntries(
    (Object.keys(GRID_CONFIGS) as GridMode[]).map((m) => [m, { ...EMPTY_STATS }])
  ) as StatsByBoard;
}

function parseStats(v: unknown): LifetimeStats {
  const out = { ...EMPTY_STATS };
  if (!v || typeof v !== 'object') return out;
  const p = v as Record<string, unknown>;
  for (const k of Object.keys(EMPTY_STATS) as (keyof LifetimeStats)[]) {
    const n = p[k];
    if (typeof n === 'number' && Number.isFinite(n) && n >= 0) out[k] = n;
  }
  return out;
}

export function loadStats(): StatsByBoard {
  const raw = readItem(STATS_KEY);
  const out = emptyStatsByBoard();
  if (!raw) return out;
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    for (const mode of Object.keys(GRID_CONFIGS) as GridMode[]) out[mode] = parseStats(p[mode]);
    return out;
  } catch {
    return out;
  }
}

export function saveStats(stats: StatsByBoard): void {
  writeItem(STATS_KEY, JSON.stringify(stats));
}

export function resetStats(): void {
  removeItem(STATS_KEY);
}
