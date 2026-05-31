import type { Grid, GridCfg, NukeCrossResult } from '../types';
import { DEFAULT_CFG } from './config';

export const MAX_COMBO = 5;
export const NUKE_COMBO = 6;

export function nextCombo(combo: number): number {
  return Math.min(combo + 1, NUKE_COMBO);
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
      score += grid[CENTER_ROW][c];
    }
  }
  for (let r = 0; r < ROWS; r++) {
    if (r !== CENTER_ROW && grid[r][CENTER_COL] !== 0) {
      cells.push([r, CENTER_COL]);
      score += grid[r][CENTER_COL];
    }
  }
  return { cells, score };
}
