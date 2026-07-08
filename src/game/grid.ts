import type { Grid, GridCfg } from '../types';
import { DEFAULT_CFG } from './config';
import { randTileSideExcluding2 } from './tiles';
import { isCornerCell } from './corners';

// True when every non-corner cell is empty — the "clean sweep" condition.
// Corner blocks are excluded: they refill themselves and can never stay empty.
export function isPlayAreaEmpty(grid: Grid, cfg: GridCfg = DEFAULT_CFG): boolean {
  for (let r = 0; r < cfg.ROWS; r++) {
    for (let c = 0; c < cfg.COLS; c++) {
      if (grid[r][c] !== 0 && !isCornerCell(r, c, cfg)) return false;
    }
  }
  return true;
}

export function createInitialGrid(cfg: GridCfg = DEFAULT_CFG): Grid {
  const { ROWS, COLS, PENDING_SIZE, PENDING_COL_START, PENDING_ROW_START, CENTER_ROW } = cfg;
  const grid: Grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));

  // Diamond centered at (CENTER_ROW, CENTER_COL):
  // PENDING_SIZE wide at center row, tapering by 2 per row above/below
  for (let step = 0, width = PENDING_SIZE; width >= 1; step++, width -= 2) {
    const start = PENDING_COL_START + Math.floor((PENDING_SIZE - width) / 2);
    const fillRow = (r: number) => {
      if (r >= 0 && r < ROWS) {
        for (let j = 0; j < width; j++) {
          grid[r][start + j] = Math.min(j + 1, width - j);
        }
      }
    };
    fillRow(CENTER_ROW - step);
    if (step > 0) fillRow(CENTER_ROW + step);
  }

  // Fill corner blocks left-to-right, top-to-bottom, excluding left and above neighbours
  const fillCornerBlock = (rows: number[], cols: number[]) => {
    for (let ri = 0; ri < rows.length; ri++) {
      for (let ci = 0; ci < cols.length; ci++) {
        const r = rows[ri];
        const c = cols[ci];
        const above = ri > 0 ? grid[rows[ri - 1]][c] : -1;
        const left = ci > 0 ? grid[r][cols[ci - 1]] : -1;
        grid[r][c] = randTileSideExcluding2(above, left);
      }
    }
  };

  const topRows = Array.from({ length: PENDING_ROW_START }, (_, i) => i);
  const botRows = Array.from({ length: PENDING_ROW_START }, (_, i) => ROWS - PENDING_ROW_START + i);
  const leftCols = Array.from({ length: PENDING_COL_START }, (_, i) => i);
  const rightCols = Array.from({ length: PENDING_COL_START }, (_, i) => COLS - PENDING_COL_START + i);

  fillCornerBlock(topRows, leftCols);
  fillCornerBlock(topRows, rightCols);
  fillCornerBlock(botRows, leftCols);
  fillCornerBlock(botRows, rightCols);

  return grid;
}
