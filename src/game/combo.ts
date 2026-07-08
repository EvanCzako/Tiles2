import type { Grid, GridCfg, NukeCrossResult } from '../types';
import { DEFAULT_CFG } from './config';
import { baseValue } from './tiles';

export const MAX_COMBO = 5;

// ── Player abilities ─────────────────────────────────────────────────────────
// Nuke: each annihilation wave adds its combo multiplier to the charge meter.
// At NUKE_CHARGE_MAX the player may fire the center-cross nuke manually.
export const NUKE_CHARGE_MAX = 12;
// Reroll: the player may reroll one pending strip, then must wait this many
// turns (pushes) before the ability is available again.
export const REROLL_COOLDOWN = 10;
// Clean sweep: emptying the entire play area in one turn awards
// bonus = CLEAN_SWEEP_BONUS_PER_TILE × tiles cleared that turn × combo,
// plus a fully charged nuke. Scaling by tiles cleared keeps trivial
// early-game sweeps from paying like late-game ones.
export const CLEAN_SWEEP_BONUS_PER_TILE = 25;

export function nextCombo(combo: number): number {
  return Math.min(combo + 1, MAX_COMBO);
}

// Returns the cells and raw score for the center-cross nuke (center row + center col).
// Caller should multiply score by MAX_COMBO.
export function nukeCrossScore(grid: Grid, cfg: GridCfg = DEFAULT_CFG): NukeCrossResult {
  const { ROWS, COLS, CENTER_ROW, CENTER_COL } = cfg;
  const cells: [number, number][] = [];
  let score = 0;
  for (let c = 0; c < COLS; c++) {
    if (grid[CENTER_ROW][c] !== 0) {
      cells.push([CENTER_ROW, c]);
      score += baseValue(grid[CENTER_ROW][c]);
    }
  }
  for (let r = 0; r < ROWS; r++) {
    if (r !== CENTER_ROW && grid[r][CENTER_COL] !== 0) {
      cells.push([r, CENTER_COL]);
      score += baseValue(grid[r][CENTER_COL]);
    }
  }
  return { cells, score };
}
