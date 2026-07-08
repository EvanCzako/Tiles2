import type { Grid, GridCfg, Move, CollapseResult } from '../types';
import { DEFAULT_CFG } from './config';
import { isCornerCell } from './corners';
import { isStone } from './tiles';

// A cell is an immovable obstacle if it's a corner cell (position-based) OR a stone tile (value-based).
// Obstacles never move during gravity/horizontal collapse, and — crucially — they act as
// directional barriers: live tiles pack toward CENTER, but they cannot slide *past* an obstacle.
function isObstacle(r: number, c: number, v: number, cfg: GridCfg): boolean {
  return isCornerCell(r, c, cfg) || isStone(v);
}

// Pack the non-empty, non-wall tiles in index range [lo, hi] of a 1-D line toward `hi` (dir = +1)
// or toward `lo` (dir = -1). Walls split the range into independent segments; each segment packs
// toward the dir-end of *that* segment, so a tile can never cross a wall (stone/corner barrier).
// Tiles keep their relative order. `onMove(from, to, v)` is fired for every tile that actually moves.
function packLine(
  lo: number,
  hi: number,
  dir: 1 | -1,
  get: (i: number) => number,
  set: (i: number, v: number) => void,
  isWall: (i: number) => boolean,
  onMove: (from: number, to: number, v: number) => void,
): void {
  let i = lo;
  while (i <= hi) {
    if (isWall(i)) { i++; continue; }
    // Grow a maximal wall-free segment [segLo, segHi].
    const segLo = i;
    let segHi = i;
    while (segHi + 1 <= hi && !isWall(segHi + 1)) segHi++;

    const tiles: { from: number; v: number }[] = [];
    for (let k = segLo; k <= segHi; k++) {
      const v = get(k);
      if (v !== 0) tiles.push({ from: k, v });
      set(k, 0);
    }
    let dest = dir > 0 ? segHi - tiles.length + 1 : segLo;
    for (const { from, v } of tiles) {
      set(dest, v);
      if (from !== dest) onMove(from, dest, v);
      dest++;
    }
    i = segHi + 1;
  }
}

export function collapseGrid(
  grid: Grid,
  cfg: GridCfg = DEFAULT_CFG,
  lastVerticalSide: 'top' | 'bottom' = 'top',
  lastHorizontalSide: 'left' | 'right' = 'left'
): CollapseResult {
  const { ROWS, COLS, CENTER_COL, CENTER_ROW } = cfg;
  const newGrid = grid.map((row) => [...row]);
  const gravityMoves: Move[] = [];
  const horizontalMoves: Move[] = [];

  // Phase 1: gravity toward CENTER_ROW. The claiming side packs first and wins CENTER_ROW; the
  // other side then packs against it. If the claiming side leaves CENTER_ROW empty (no tiles, or
  // an obstacle blocks them from reaching it), the other side is allowed to fill CENTER_ROW.
  for (let c = 0; c < COLS; c++) {
    const get = (r: number) => newGrid[r][c];
    const set = (r: number, v: number) => { newGrid[r][c] = v; };
    const isWall = (r: number) => isObstacle(r, c, newGrid[r][c], cfg);
    const onMove = (from: number, to: number, v: number) =>
      gravityMoves.push({ value: v, fromRow: from, fromCol: c, toRow: to, toCol: c });

    if (lastVerticalSide === 'top') {
      packLine(0, CENTER_ROW, 1, get, set, isWall, onMove);
      const ceil = newGrid[CENTER_ROW][c] === 0 ? CENTER_ROW : CENTER_ROW + 1;
      packLine(ceil, ROWS - 1, -1, get, set, isWall, onMove);
    } else {
      packLine(CENTER_ROW, ROWS - 1, -1, get, set, isWall, onMove);
      const floor = newGrid[CENTER_ROW][c] === 0 ? CENTER_ROW : CENTER_ROW - 1;
      packLine(0, floor, 1, get, set, isWall, onMove);
    }
  }

  const midGrid = newGrid.map((row) => [...row]);

  // Phase 2: horizontal collapse toward CENTER_COL — same claim/barrier rules on each row.
  for (let r = 0; r < ROWS; r++) {
    const get = (c: number) => newGrid[r][c];
    const set = (c: number, v: number) => { newGrid[r][c] = v; };
    const isWall = (c: number) => isObstacle(r, c, newGrid[r][c], cfg);
    const onMove = (from: number, to: number, v: number) =>
      horizontalMoves.push({ value: v, fromRow: r, fromCol: from, toRow: r, toCol: to });

    if (lastHorizontalSide === 'left') {
      packLine(0, CENTER_COL, 1, get, set, isWall, onMove);
      const ceil = newGrid[r][CENTER_COL] === 0 ? CENTER_COL : CENTER_COL + 1;
      packLine(ceil, COLS - 1, -1, get, set, isWall, onMove);
    } else {
      packLine(CENTER_COL, COLS - 1, -1, get, set, isWall, onMove);
      const floor = newGrid[r][CENTER_COL] === 0 ? CENTER_COL : CENTER_COL - 1;
      packLine(0, floor, 1, get, set, isWall, onMove);
    }
  }

  return { grid: newGrid, midGrid, gravityMoves, horizontalMoves };
}
