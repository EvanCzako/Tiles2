import type { GridCfg, TileColor, PaletteId } from '../types';
import { DEFAULT_CFG } from './config';

// ── Specialty tile flags ─────────────────────────────────────────────────────
// Specialty tiles are stored as (base value + FLAG) so they ride through gravity,
// push, and corner-settle untouched — those only shuffle numbers / test `=== 0`.
// Decode with baseValue()/is*() at the points that interpret the number:
// matching (annihilate), rendering (Tile/FlyingTile/getTileColor), and scoring.
//
// Flag ranges (non-overlapping):
//   1–9       regular tiles
//   1001–1009 bomb      (BOMB_FLAG   = 1000): detonates a 3×3 blast on annihilation
//   2001–2009 locked    (LOCKED_FLAG = 2000): needs 2 matches — first hit unlocks it
//   3001–3009 stone     (STONE_FLAG  = 3000): immovable during gravity/push
export const BOMB_FLAG   = 1000;
export const LOCKED_FLAG = 2000;
export const STONE_FLAG  = 3000;

export const BOMB_CHANCE   = 0.025; // ~2.5%  of newly spawned pending tiles
export const LOCKED_CHANCE = 0;    // disabled for now — lock tiles never spawn (all unlock logic kept)
export const STONE_CHANCE  = 0.03; // ~3%  of newly spawned pending tiles

export function isBomb(v: number): boolean   { return v >= BOMB_FLAG   && v < LOCKED_FLAG; }
export function isLocked(v: number): boolean { return v >= LOCKED_FLAG && v < STONE_FLAG; }
export function isStone(v: number): boolean  { return v >= STONE_FLAG; }

export function baseValue(v: number): number {
  if (v >= STONE_FLAG)  return v - STONE_FLAG;
  if (v >= LOCKED_FLAG) return v - LOCKED_FLAG;
  if (v >= BOMB_FLAG)   return v - BOMB_FLAG;
  return v;
}

// Static low-skew reference table. The LIVE distribution is driven by the
// difficulty ramp (setDifficulty) below; this constant is only a static
// reference for the simulator's non-ramped distribution sweeps.
export const DEFAULT_SPAWN_WEIGHTS = [13, 12, 12, 11, 11, 10, 10, 9, 9];

// ── Difficulty ramp ─────────────────────────────────────────────────────────
// Spawn odds evolve with turns survived. Survival is governed by MATCH SCARCITY
// — two same-value tiles must land adjacent to clear — so the game hardens by
// SPREADING the value distribution (flatten easy→uniform, then fade in a 10th
// value; neighbours share a value less often and board-wide wipes clear fewer
// copies) and by raising STONE frequency, the *unbounded* clutter lever (stones
// can't be repositioned into a match, so they pile up until even perfect play
// chokes — this is what caps runaway games). The helpful bomb stays flat; a
// "needs two hits" lock fades in late. Both the store (per push) and the
// simulator (per turn) call setDifficulty(turn), so they share one curve.
// Start AT the current shipped difficulty (not easier) so the early-game skill
// gap is preserved, then harden the tail. An easier start would help careless
// play survive the opening and narrow the very gap we want to widen.
const RAMP_GRACE = 30;    // turns before hardening begins
const RAMP_FULL = 300;    // turn the value ramp reaches its flat max
const TENTH_START = 120;  // the fade-in extra value begins appearing (a primary value-spread lever)
const TENTH_FULL = 400;   // ...reaching parity with the other values
const TENTH_MAX = 10;
// Hard ceiling on distinct tile values: getTileColor / the tile palettes define
// colors for 1–10 only (values >10 render as a white fallback), so the fade-in
// extra value is suppressed once a board already spawns 10 base values.
const MAX_VALUES = 10;
const STONE_SLOPE = 0.0004; // stone chance added per turn past the grace window
const STONE_MAX = 0.22;
const LOCKED_START = 250;  // locks begin appearing
const LOCKED_SLOPE = 0.0002;
const LOCKED_MAX = 0.05;

// ── Per-board value spread ───────────────────────────────────────────────────
// Match scarcity is the survival governor, and it depends on both value count
// and board area. A smaller board fills faster and offers less room to maneuver,
// so it needs FEWER distinct values (more frequent matches) to survive as long
// as 9x9; a larger board needs MORE values. Each board ramps from a near-flat
// `easy` table (turn 0) toward a uniform `hard` table, with one extra value
// (the fade-in "tenth") appearing mid-run — all scaled to the board's value
// count. 9x9 keeps the shipped 9→10 curve byte-for-byte.
interface BoardRamp {
  easy: number[];  // turn-0 near-flat weights (length = value count)
  hard: number[];  // uniform hard target (same length)
}

// Near-flat descending easy table 13→9 across n values, paired with a uniform
// hard target. n=9 special-cased to the exact shipped table.
function makeBoardRamp(n: number): BoardRamp {
  if (n === 9) return { easy: [13, 12, 12, 11, 11, 10, 10, 9, 9], hard: Array(9).fill(10) };
  const easy = Array.from({ length: n }, (_, i) => Math.round(13 - (4 * i) / (n - 1)));
  return { easy, hard: Array(n).fill(10) };
}

// Turn-0 value counts per board. 9x9 is the reference (9 values → a 10th fades
// in). Sim-tuned so 7x7 and 11x11 survival/score track 9x9 (see scripts/simulate.ts).
export const BOARD_VALUE_COUNTS: Record<string, number> = {
  '7x7': 7,
  '9x9': 9,
  '11x11': 10,
};

// Per-board stone-ramp multiplier — the fine-tuning lever after value count.
// Value count is coarse (each step roughly doubles survival) and is capped at
// MAX_VALUES, so a bigger board can't spread values further to compensate for
// its extra room. 11x11 pinned at the 10-value ceiling still outlived 9x9 for
// skilled play, and the roomy board shrugs off a mild stone bump, so its stones
// ramp ~3x faster — reaching the shared STONE_MAX (22%) by ~turn 190 to give the
// big board a comparable late-game choke. Sim-tuned so the planner bot's median
// survival tracks 9x9 (see scripts/simulate.ts). 1.0 = shipped 9x9 rate; note
// STONE_MAX is shared, so no board ever exceeds 9x9's peak stone density.
export const BOARD_STONE_SCALE: Record<string, number> = {
  '7x7': 1,
  '9x9': 1,
  '11x11': 3.0,
};
const DEFAULT_VALUE_COUNT = 9;

let boardRamps: Record<string, BoardRamp> = Object.fromEntries(
  Object.entries(BOARD_VALUE_COUNTS).map(([m, n]) => [m, makeBoardRamp(n)])
);

// Test hook: override a board's value count (rebuilds its ramp). Used by the
// simulator's value-count sweep; the game always uses BOARD_VALUE_COUNTS.
export function setBoardValueCount(board: string, n: number): void {
  boardRamps = { ...boardRamps, [board]: makeBoardRamp(n) };
}

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

export interface SpawnMix {
  weights: number[];
  bomb: number;
  stone: number;
  locked: number;
}

// Spawn odds for a given turn on a given board. Pure — shared by the game, the
// simulator, and tests. `board` selects the per-board value spread.
export function rampedSpawn(turn: number, board = '9x9'): SpawnMix {
  const { easy, hard } = boardRamps[board] ?? makeBoardRamp(DEFAULT_VALUE_COUNT);
  const d = clamp01((turn - RAMP_GRACE) / (RAMP_FULL - RAMP_GRACE));
  const weights = easy.map((e, i) => e + d * (hard[i] - e));
  const tenth = clamp01((turn - TENTH_START) / (TENTH_FULL - TENTH_START)) * TENTH_MAX;
  if (tenth > 0 && weights.length < MAX_VALUES) weights.push(tenth);
  const past = Math.max(0, turn - RAMP_GRACE);
  const stoneScale = BOARD_STONE_SCALE[board] ?? 1;
  return {
    weights,
    bomb: BOMB_CHANCE,
    stone: Math.min(STONE_MAX, STONE_CHANCE + past * STONE_SLOPE * stoneScale),
    locked: Math.min(LOCKED_MAX, Math.max(0, turn - LOCKED_START) * LOCKED_SLOPE),
  };
}

// ── Live spawn state (driven by the ramp; overridable by the simulator) ──────
let spawnWeights: number[] = rampedSpawn(0).weights;
let curBomb = BOMB_CHANCE;
let curStone = STONE_CHANCE;
let curLocked = LOCKED_CHANCE;

// Apply the ramp for a given turn on a given board — the game calls this before
// each push, the simulator before each turn, so both follow the identical
// difficulty curve for that board.
export function setDifficulty(turn: number, board = '9x9'): void {
  const m = rampedSpawn(turn, board);
  spawnWeights = m.weights;
  curBomb = m.bomb;
  curStone = m.stone;
  curLocked = m.locked;
}

// Override the value weights only (special chances untouched) — used by the
// simulator's static, non-ramped distribution sweeps.
export function setSpawnWeights(weights: number[]): void {
  spawnWeights = weights.slice();
}

// Reset special-tile chances to their base (turn-0) values.
export function resetSpecials(): void {
  curBomb = BOMB_CHANCE;
  curStone = STONE_CHANCE;
  curLocked = LOCKED_CHANCE;
}

export function randTileSide(): number {
  const total = spawnWeights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < spawnWeights.length; i++) {
    r -= spawnWeights[i];
    if (r < 0) return i + 1;
  }
  return spawnWeights.length;
}

// Exclusions compare base values so a bomb-N / locked-N is still treated as "an N".
export function randTileSideExcluding(...exclude: number[]): number {
  const ex = new Set(exclude.map(baseValue));
  let v: number;
  do { v = randTileSide(); } while (ex.has(v));
  return v;
}

// Pending tiles can spawn as bombs, locked, or stone; corner-block / initial-board tiles do not.
export function randPendingTile(exclude: number): number {
  const v = randTileSideExcluding(exclude);
  const r = Math.random();
  if (r < curBomb)                        return v + BOMB_FLAG;
  if (r < curBomb + curLocked)            return v + LOCKED_FLAG;
  if (r < curBomb + curLocked + curStone) return v + STONE_FLAG;
  return v;
}

export function createInitialPending(cfg: GridCfg = DEFAULT_CFG): number[] {
  const arr: number[] = [];
  for (let i = 0; i < cfg.PENDING_SIZE; i++) arr.push(randTileSideExcluding(arr[i - 1] ?? -1));
  return arr;
}

// ── Tile color palettes ───────────────────────────────────────────────────
// Empty cells (0) share the same dark background across every palette so the
// board reads consistently. Tiles 1–10 are tuned per color-vision profile.
// Regular tiles still show their number, so color is a secondary cue; bombs
// rely on color alone (plus the 💣 glyph), which is why the palettes matter.
type TilePalette = Record<number, TileColor>;

const EMPTY: TileColor = { bg: '#272744', text: 'transparent' };

const TILE_PALETTES: Record<PaletteId, TilePalette> = {
  // Vibrant rainbow ramp (original look)
  default: {
    0: EMPTY,
    1: { bg: '#4488ee', text: '#fff' },
    2: { bg: '#22bbaa', text: '#fff' },
    3: { bg: '#44cc66', text: '#fff' },
    4: { bg: '#99cc22', text: '#fff' },
    5: { bg: '#ffcc00', text: '#222' },
    6: { bg: '#ff8822', text: '#fff' },
    7: { bg: '#ff4422', text: '#fff' },
    8: { bg: '#dd1144', text: '#fff' },
    9: { bg: '#cc1188', text: '#fff' },
    10: { bg: '#8822cc', text: '#fff' },
  },
  // Deuteranopia (green-weak): lean on the blue↔yellow/orange axis + luminance
  deuteranopia: {
    0: EMPTY,
    1: { bg: '#1a3a8f', text: '#fff' },
    2: { bg: '#4a90d9', text: '#fff' },
    3: { bg: '#7b6bd6', text: '#fff' },
    4: { bg: '#b07fd1', text: '#fff' },
    5: { bg: '#e0c200', text: '#222' },
    6: { bg: '#f29e00', text: '#222' },
    7: { bg: '#e8650e', text: '#fff' },
    8: { bg: '#b34700', text: '#fff' },
    9: { bg: '#6b6b6b', text: '#fff' },
    10: { bg: '#c0c0c0', text: '#222' },
  },
  // Protanopia (red-weak): avoid dark reds; blue/cyan/yellow/amber spread
  protanopia: {
    0: EMPTY,
    1: { bg: '#003a7d', text: '#fff' },
    2: { bg: '#2e7bbf', text: '#fff' },
    3: { bg: '#56b4e9', text: '#222' },
    4: { bg: '#8e7cc3', text: '#fff' },
    5: { bg: '#f0e442', text: '#222' },
    6: { bg: '#f6c141', text: '#222' },
    7: { bg: '#e8861e', text: '#fff' },
    8: { bg: '#a05a00', text: '#fff' },
    9: { bg: '#777777', text: '#fff' },
    10: { bg: '#cfcfcf', text: '#222' },
  },
  // Tritanopia (blue-yellow confusion): lean on the red↔green axis
  tritanopia: {
    0: EMPTY,
    1: { bg: '#4d9221', text: '#fff' },
    2: { bg: '#7fbc41', text: '#222' },
    3: { bg: '#b8e186', text: '#222' },
    4: { bg: '#c51b7d', text: '#fff' },
    5: { bg: '#de77ae', text: '#222' },
    6: { bg: '#f1b6da', text: '#222' },
    7: { bg: '#b2182b', text: '#fff' },
    8: { bg: '#762a83', text: '#fff' },
    9: { bg: '#1b7837', text: '#fff' },
    10: { bg: '#999999', text: '#fff' },
  },
  // Monochrome: luminance-only ramp (also helps achromatopsia)
  monochrome: {
    0: EMPTY,
    1: { bg: '#2b2b2b', text: '#fff' },
    2: { bg: '#444444', text: '#fff' },
    3: { bg: '#5d5d5d', text: '#fff' },
    4: { bg: '#767676', text: '#fff' },
    5: { bg: '#8f8f8f', text: '#fff' },
    6: { bg: '#a8a8a8', text: '#222' },
    7: { bg: '#c1c1c1', text: '#222' },
    8: { bg: '#d4d4d4', text: '#222' },
    9: { bg: '#e6e6e6', text: '#222' },
    10: { bg: '#f7f7f7', text: '#222' },
  },
};

export const PALETTE_IDS = Object.keys(TILE_PALETTES) as PaletteId[];

export const PALETTE_LABELS: Record<PaletteId, string> = {
  default: 'Default',
  deuteranopia: 'Deuteranopia',
  protanopia: 'Protanopia',
  tritanopia: 'Tritanopia',
  monochrome: 'Monochrome',
};

export function getTileColor(value: number, palette: PaletteId = 'default'): TileColor {
  const base = baseValue(value);
  const map = TILE_PALETTES[palette] ?? TILE_PALETTES.default;
  return map[base] ?? { bg: '#fff', text: '#333' };
}
