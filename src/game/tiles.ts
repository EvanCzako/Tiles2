import type { GridCfg, TileColor, PaletteId } from '../types';
import { DEFAULT_CFG } from './config';

// ── Specialty tile flags ─────────────────────────────────────────────────────
// Specialty tiles are stored as (base value + FLAG) so they ride through gravity,
// push, and corner-settle untouched — those only shuffle numbers / test `=== 0`.
// Decode with baseValue()/is*() at the points that interpret the number:
// matching (annihilate), rendering (Tile/FlyingTile/getTileColor), and scoring.
//
// Flag ranges (non-overlapping):
//   1–7       regular tiles
//   1001–1007 bomb      (BOMB_FLAG   = 1000): detonates a 3×3 blast on annihilation
//   2001–2007 locked    (LOCKED_FLAG = 2000): needs 2 matches — first hit unlocks it
//   3001–3007 stone     (STONE_FLAG  = 3000): immovable during gravity/push
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

// 1: ~22%, 2: ~19%, 3: ~16%, 4: ~14%, 5: ~12%, 6: ~10%, 7: ~7%
export function randTileSide(): number {
  const r = Math.random() * 100;
  if (r < 22) return 1;
  if (r < 41) return 2;
  if (r < 57) return 3;
  if (r < 71) return 4;
  if (r < 83) return 5;
  if (r < 93) return 6;
  return 7;
}

// Exclusions compare base values so a bomb-N / locked-N is still treated as "an N".
export function randTileSideExcluding(exclude: number): number {
  const ex = baseValue(exclude);
  let v: number;
  do { v = randTileSide(); } while (v === ex);
  return v;
}

export function randTileSideExcluding2(a: number, b: number): number {
  const ea = baseValue(a), eb = baseValue(b);
  let v: number;
  do { v = randTileSide(); } while (v === ea || v === eb);
  return v;
}

// Pending tiles can spawn as bombs, locked, or stone; corner-block / initial-board tiles do not.
export function randPendingTile(exclude: number): number {
  const v = randTileSideExcluding(exclude);
  const r = Math.random();
  if (r < BOMB_CHANCE)                              return v + BOMB_FLAG;
  if (r < BOMB_CHANCE + LOCKED_CHANCE)              return v + LOCKED_FLAG;
  if (r < BOMB_CHANCE + LOCKED_CHANCE + STONE_CHANCE) return v + STONE_FLAG;
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
