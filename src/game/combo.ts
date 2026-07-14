import type { Grid, GridCfg, NukeCrossResult } from '../types';
import { DEFAULT_CFG } from './config';
import { baseValue } from './tiles';

export const MAX_COMBO = 5;

// ── Player abilities ─────────────────────────────────────────────────────────
// Nuke: each annihilation wave adds its combo multiplier to the charge meter.
// At NUKE_CHARGE_MAX the meter arms and the nuke may be fired manually. While
// armed the meter stops charging and drains NUKE_DECAY_PER_PUSH on every push;
// if it drains to 0 the nuke is lost and charging restarts from empty
// (use-it-or-lose-it — the nuke can't be banked as permanent insurance).
export const NUKE_CHARGE_MAX = 24;
export const NUKE_DECAY_PER_PUSH = 1;
// Reroll: the player may reroll one pending strip, then must wait this many
// turns (pushes) before the ability is available again.
export const REROLL_COOLDOWN = 10;
// Clean sweep: emptying the entire play area in one turn awards
// bonus = CLEAN_SWEEP_BONUS_PER_TILE × tiles cleared that turn × combo,
// plus half a nuke meter. Scaling by tiles cleared keeps trivial
// early-game sweeps from paying like late-game ones.
export const CLEAN_SWEEP_BONUS_PER_TILE = 25;

export function nextCombo(combo: number): number {
  return Math.min(combo + 1, MAX_COMBO);
}

// The nuke's blast shape: a 5×5 plus at the board center (center cell + its
// 2 nearest orthogonal neighbours in each of the 4 directions).
export function nukePlusCells(cfg: GridCfg = DEFAULT_CFG): [number, number][] {
  const { ROWS, COLS, CENTER_ROW, CENTER_COL } = cfg;
  const offsets: [number, number][] = [
    [0, 0],
    [-1, 0], [-2, 0], [1, 0], [2, 0],
    [0, -1], [0, -2], [0, 1], [0, 2],
  ];
  return offsets
    .map(([dr, dc]): [number, number] => [CENTER_ROW + dr, CENTER_COL + dc])
    .filter(([r, c]) => r >= 0 && r < ROWS && c >= 0 && c < COLS);
}

// Returns the non-empty cells and raw score for the center-plus nuke.
// Caller should multiply score by MAX_COMBO.
export function nukeCrossScore(grid: Grid, cfg: GridCfg = DEFAULT_CFG): NukeCrossResult {
  const cells: [number, number][] = [];
  let score = 0;
  for (const [r, c] of nukePlusCells(cfg)) {
    if (grid[r][c] !== 0) {
      cells.push([r, c]);
      score += baseValue(grid[r][c]);
    }
  }
  return { cells, score };
}
