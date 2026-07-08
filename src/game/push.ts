import type { Grid, GridCfg, PushResult } from '../types';
import { DEFAULT_CFG } from './config';
import { randPendingTile } from './tiles';

export function pushFromLeft(grid: Grid, leftPending: number[], cfg: GridCfg = DEFAULT_CFG): PushResult {
  const { COLS, PENDING_SIZE, PENDING_ROW_START, CENTER_COL } = cfg;
  const newGrid = grid.map((row) => [...row]);
  const newPending = [...leftPending];
  const landings: PushResult['landings'] = [];
  const blockedIndices: number[] = [];

  const rowLeftmost: number[] = [];
  for (let i = 0; i < PENDING_SIZE; i++) {
    const row = PENDING_ROW_START + i;
    let leftmost = -1;
    for (let c = 0; c < COLS; c++) {
      if (newGrid[row][c] !== 0) { leftmost = c; break; }
    }
    rowLeftmost.push(leftmost);
  }

  for (let i = 0; i < PENDING_SIZE; i++) {
    const row = PENDING_ROW_START + i;
    const tileVal = newPending[i];
    if (tileVal === 0) continue;
    const leftmost = rowLeftmost[i];
    if (leftmost === -1) {
      newGrid[row][CENTER_COL] = tileVal;
      landings.push({ pendingIdx: i, row, col: CENTER_COL, merged: false });
    } else if (leftmost > 0) {
      // Stop just before the nearest tile, but never travel past CENTER_COL — an
      // immovable tile (e.g. a stone) beyond center must not pull the landing across it.
      const col = Math.min(leftmost - 1, CENTER_COL);
      newGrid[row][col] = tileVal;
      landings.push({ pendingIdx: i, row, col, merged: false });
    } else {
      blockedIndices.push(i);
      continue;
    }
    newPending[i] = randPendingTile(i > 0 ? newPending[i - 1] : -1);
  }
  return { grid: newGrid, pending: newPending, landings, blockedIndices };
}

export function pushFromRight(grid: Grid, rightPending: number[], cfg: GridCfg = DEFAULT_CFG): PushResult {
  const { COLS, PENDING_SIZE, PENDING_ROW_START, CENTER_COL } = cfg;
  const newGrid = grid.map((row) => [...row]);
  const newPending = [...rightPending];
  const landings: PushResult['landings'] = [];
  const blockedIndices: number[] = [];

  const rowRightmost: number[] = [];
  for (let i = 0; i < PENDING_SIZE; i++) {
    const row = PENDING_ROW_START + i;
    let rightmost = -1;
    for (let c = COLS - 1; c >= 0; c--) {
      if (newGrid[row][c] !== 0) { rightmost = c; break; }
    }
    rowRightmost.push(rightmost);
  }

  for (let i = 0; i < PENDING_SIZE; i++) {
    const row = PENDING_ROW_START + i;
    const tileVal = newPending[i];
    if (tileVal === 0) continue;
    const rightmost = rowRightmost[i];
    if (rightmost === -1) {
      newGrid[row][CENTER_COL] = tileVal;
      landings.push({ pendingIdx: i, row, col: CENTER_COL, merged: false });
    } else if (rightmost < COLS - 1) {
      // Stop just before the nearest tile, but never travel past CENTER_COL.
      const col = Math.max(rightmost + 1, CENTER_COL);
      newGrid[row][col] = tileVal;
      landings.push({ pendingIdx: i, row, col, merged: false });
    } else {
      blockedIndices.push(i);
      continue;
    }
    newPending[i] = randPendingTile(i > 0 ? newPending[i - 1] : -1);
  }
  return { grid: newGrid, pending: newPending, landings, blockedIndices };
}

export function pushFromTop(grid: Grid, topPending: number[], cfg: GridCfg = DEFAULT_CFG): PushResult {
  const { ROWS, PENDING_COL_START, CENTER_ROW } = cfg;
  const newGrid = grid.map((row) => [...row]);
  const newPending = [...topPending];
  const landings: PushResult['landings'] = [];
  const blockedIndices: number[] = [];

  for (let i = 0; i < newPending.length; i++) {
    const col = PENDING_COL_START + i;
    const tileVal = newPending[i];
    if (tileVal === 0) continue;
    let topmost = -1;
    for (let r = 0; r < ROWS; r++) {
      if (newGrid[r][col] !== 0) { topmost = r; break; }
    }
    if (topmost === -1) {
      newGrid[CENTER_ROW][col] = tileVal;
      landings.push({ pendingIdx: i, row: CENTER_ROW, col, merged: false });
    } else if (topmost > 0) {
      // Stop just before the nearest tile, but never travel past CENTER_ROW.
      const r = Math.min(topmost - 1, CENTER_ROW);
      newGrid[r][col] = tileVal;
      landings.push({ pendingIdx: i, row: r, col, merged: false });
    } else {
      blockedIndices.push(i);
      continue;
    }
    newPending[i] = randPendingTile(i > 0 ? newPending[i - 1] : -1);
  }
  return { grid: newGrid, pending: newPending, landings, blockedIndices };
}

export function pushFromBottom(grid: Grid, bottomPending: number[], cfg: GridCfg = DEFAULT_CFG): PushResult {
  const { ROWS, PENDING_COL_START, CENTER_ROW } = cfg;
  const newGrid = grid.map((row) => [...row]);
  const newPending = [...bottomPending];
  const landings: PushResult['landings'] = [];
  const blockedIndices: number[] = [];

  for (let i = 0; i < newPending.length; i++) {
    const col = PENDING_COL_START + i;
    const tileVal = newPending[i];
    if (tileVal === 0) continue;
    let bottommost = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (newGrid[r][col] !== 0) { bottommost = r; break; }
    }
    if (bottommost === -1) {
      newGrid[CENTER_ROW][col] = tileVal;
      landings.push({ pendingIdx: i, row: CENTER_ROW, col, merged: false });
    } else if (bottommost < ROWS - 1) {
      // Stop just before the nearest tile, but never travel past CENTER_ROW.
      const r = Math.max(bottommost + 1, CENTER_ROW);
      newGrid[r][col] = tileVal;
      landings.push({ pendingIdx: i, row: r, col, merged: false });
    } else {
      blockedIndices.push(i);
      continue;
    }
    newPending[i] = randPendingTile(i > 0 ? newPending[i - 1] : -1);
  }
  return { grid: newGrid, pending: newPending, landings, blockedIndices };
}

function sideHasLanding(
  grid: Grid,
  cfg: GridCfg,
  pushFn: (grid: Grid, pending: number[], cfg: GridCfg) => PushResult
): boolean {
  const dummy = Array(cfg.PENDING_SIZE).fill(1) as number[];
  return pushFn(grid, dummy, cfg).landings.some((l) => !l.flyThrough);
}

export function checkGameOver(grid: Grid, cfg: GridCfg): boolean {
  return (
    !sideHasLanding(grid, cfg, pushFromLeft) &&
    !sideHasLanding(grid, cfg, pushFromRight) &&
    !sideHasLanding(grid, cfg, pushFromTop) &&
    !sideHasLanding(grid, cfg, pushFromBottom)
  );
}
