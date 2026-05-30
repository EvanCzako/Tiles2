import type {
  Grid,
  GridCfg,
  PushResult,
  Landing,
  Move,
  CollapseResult,
  AnnihilateResult,
  NukeCrossResult,
  TileColor,
} from './types';

export const ROWS = 9;
export const COLS = 9;
export const PENDING_SIZE = 5;
export const CENTER_COL = Math.floor(COLS / 2);
export const CENTER_ROW = Math.floor(ROWS / 2);
export const PENDING_ROW_START = CENTER_ROW - Math.floor(PENDING_SIZE / 2);
export const PENDING_COL_START = CENTER_COL - Math.floor(PENDING_SIZE / 2);

export const GRID_CONFIGS: Record<string, GridCfg> = {
  '9x9': {
    ROWS: 9,
    COLS: 9,
    PENDING_SIZE: 5,
    PENDING_ROW_START: 2,
    PENDING_COL_START: 2,
    CENTER_COL: 4,
    CENTER_ROW: 4,
  },
  '11x11': {
    ROWS: 11,
    COLS: 11,
    PENDING_SIZE: 7,
    PENDING_ROW_START: 2,
    PENDING_COL_START: 2,
    CENTER_COL: 5,
    CENTER_ROW: 5,
  },
};

const DEFAULT_CFG = GRID_CONFIGS['9x9'];

export function createInitialGrid(cfg: GridCfg = DEFAULT_CFG): Grid {
  const { ROWS, COLS, PENDING_SIZE, PENDING_COL_START, PENDING_ROW_START, CENTER_ROW } = cfg;
  const grid: Grid = Array(ROWS)
    .fill(null)
    .map(() => Array(COLS).fill(0));

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

  // Populate corner obstacle blocks — filled left-to-right, top-to-bottom within each
  // block so each cell excludes its left and above neighbor (no adjacent same values).
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

// Side-panel distribution: moderately favors 1–3, higher values are uncommon
// 1: ~33%, 2: ~24%, 3: ~16%, 4: ~10%, 5: ~7%, 6: ~6%, 7: ~4%
function randTileSide(): number {
  const r = Math.random() * 100;
  if (r < 33) return 1;
  if (r < 57) return 2;
  if (r < 73) return 3;
  if (r < 83) return 4;
  if (r < 90) return 5;
  if (r < 96) return 6;
  return 7;
}

function randTileSideExcluding(exclude: number): number {
  let v: number;
  do {
    v = randTileSide();
  } while (v === exclude);
  return v;
}

function randTileSideExcluding2(a: number, b: number): number {
  let v: number;
  do {
    v = randTileSide();
  } while (v === a || v === b);
  return v;
}

// Each corner block described by its inner row/col (closest to board centre) and
// outer row/col (furthest). Gravity pulls tiles toward the inner edges.
interface CornerBlockSpec {
  rows: [number, number]; // [innerRow, outerRow]
  cols: [number, number]; // [innerCol, outerCol]
}

function getCornerBlockSpecs(cfg: GridCfg): CornerBlockSpec[] {
  const { ROWS, COLS, PENDING_ROW_START, PENDING_COL_START } = cfg;
  return [
    { rows: [PENDING_ROW_START - 1, 0],              cols: [PENDING_COL_START - 1, 0] },           // top-left
    { rows: [PENDING_ROW_START - 1, 0],              cols: [COLS - PENDING_COL_START, COLS - 1] },  // top-right
    { rows: [ROWS - PENDING_ROW_START, ROWS - 1],    cols: [PENDING_COL_START - 1, 0] },           // bottom-left
    { rows: [ROWS - PENDING_ROW_START, ROWS - 1],    cols: [COLS - PENDING_COL_START, COLS - 1] }, // bottom-right
  ];
}

// Two-phase corner gravity matching the main grid's collapse model:
//   Phase 1 (vertical)  — each column packs toward its inner row
//   Phase 2 (horizontal) — each row packs toward its inner col
// Returns both move sets separately so the store can animate them sequentially.
export function settleCorners(
  grid: Grid,
  cfg: GridCfg
): { grid: Grid; midGrid: Grid; verticalMoves: Move[]; horizontalMoves: Move[] } {
  const midGrid = grid.map((row) => [...row]);
  const verticalMoves: Move[] = [];

  // Phase 1: vertical — for each column in each corner, slide outer→inner if inner is empty
  for (const { rows, cols } of getCornerBlockSpecs(cfg)) {
    const [innerRow, outerRow] = rows;
    for (const c of cols) {
      if (midGrid[innerRow][c] === 0 && midGrid[outerRow][c] !== 0) {
        const v = midGrid[outerRow][c];
        midGrid[innerRow][c] = v;
        midGrid[outerRow][c] = 0;
        verticalMoves.push({ value: v, fromRow: outerRow, fromCol: c, toRow: innerRow, toCol: c });
      }
    }
  }

  const settledGrid = midGrid.map((row) => [...row]);
  const horizontalMoves: Move[] = [];

  // Phase 2: horizontal — for each row in each corner, slide outer→inner if inner is empty
  for (const { rows, cols } of getCornerBlockSpecs(cfg)) {
    const [innerCol, outerCol] = cols;
    for (const r of rows) {
      if (settledGrid[r][innerCol] === 0 && settledGrid[r][outerCol] !== 0) {
        const v = settledGrid[r][outerCol];
        settledGrid[r][innerCol] = v;
        settledGrid[r][outerCol] = 0;
        horizontalMoves.push({ value: v, fromRow: r, fromCol: outerCol, toRow: r, toCol: innerCol });
      }
    }
  }

  // Refill any remaining empty positions (always the outermost cells).
  // Fill inner-to-outer so adjacency exclusion sees already-placed neighbours.
  for (const { rows, cols } of getCornerBlockSpecs(cfg)) {
    for (const r of rows) {
      for (const c of cols) {
        if (settledGrid[r][c] !== 0) continue;
        const excluded = new Set<number>();
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as [number, number][]) {
          const nr = r + dr, nc = c + dc;
          if (
            nr >= 0 && nr < cfg.ROWS &&
            nc >= 0 && nc < cfg.COLS &&
            isCornerCell(nr, nc, cfg) &&
            settledGrid[nr][nc] !== 0
          ) excluded.add(settledGrid[nr][nc]);
        }
        let v: number;
        do { v = randTileSide(); } while (excluded.has(v));
        settledGrid[r][c] = v;
      }
    }
  }

  return { grid: settledGrid, midGrid, verticalMoves, horizontalMoves };
}

export function isCornerCell(r: number, c: number, cfg: GridCfg): boolean {
  const { PENDING_ROW_START, PENDING_SIZE, PENDING_COL_START } = cfg;
  return (
    (r < PENDING_ROW_START || r >= PENDING_ROW_START + PENDING_SIZE) &&
    (c < PENDING_COL_START || c >= PENDING_COL_START + PENDING_SIZE)
  );
}

export function createInitialPending(cfg: GridCfg = DEFAULT_CFG): number[] {
  const arr: number[] = [];
  for (let i = 0; i < cfg.PENDING_SIZE; i++) arr.push(randTileSideExcluding(arr[i - 1] ?? -1));
  return arr;
}

export function pushFromLeft(grid: Grid, leftPending: number[], cfg: GridCfg = DEFAULT_CFG): PushResult {
  const { COLS, PENDING_SIZE, PENDING_ROW_START, CENTER_ROW, CENTER_COL } = cfg;
  const newGrid = grid.map((row) => [...row]);
  const newPending = [...leftPending];
  const landings: Landing[] = [];
  const blockedIndices: number[] = [];

  const rowLeftmost: number[] = [];
  for (let i = 0; i < PENDING_SIZE; i++) {
    const row = PENDING_ROW_START + i;
    let leftmost = -1;
    for (let c = 0; c < COLS; c++) {
      if (newGrid[row][c] !== 0) {
        leftmost = c;
        break;
      }
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
      newGrid[row][leftmost - 1] = tileVal;
      landings.push({ pendingIdx: i, row, col: leftmost - 1, merged: false });
    } else {
      blockedIndices.push(i);
      continue;
    }

    newPending[i] = randTileSideExcluding(i > 0 ? newPending[i - 1] : -1);
  }

  return { grid: newGrid, pending: newPending, landings, blockedIndices };
}

export function pushFromRight(grid: Grid, rightPending: number[], cfg: GridCfg = DEFAULT_CFG): PushResult {
  const { COLS, PENDING_SIZE, PENDING_ROW_START, CENTER_ROW, CENTER_COL } = cfg;
  const newGrid = grid.map((row) => [...row]);
  const newPending = [...rightPending];
  const landings: Landing[] = [];
  const blockedIndices: number[] = [];

  const rowRightmost: number[] = [];
  for (let i = 0; i < PENDING_SIZE; i++) {
    const row = PENDING_ROW_START + i;
    let rightmost = -1;
    for (let c = COLS - 1; c >= 0; c--) {
      if (newGrid[row][c] !== 0) {
        rightmost = c;
        break;
      }
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
      newGrid[row][rightmost + 1] = tileVal;
      landings.push({ pendingIdx: i, row, col: rightmost + 1, merged: false });
    } else {
      blockedIndices.push(i);
      continue;
    }

    newPending[i] = randTileSideExcluding(i > 0 ? newPending[i - 1] : -1);
  }

  return { grid: newGrid, pending: newPending, landings, blockedIndices };
}

export function pushFromTop(grid: Grid, topPending: number[], cfg: GridCfg = DEFAULT_CFG): PushResult {
  const { ROWS, PENDING_COL_START, CENTER_ROW, CENTER_COL } = cfg;
  const newGrid = grid.map((row) => [...row]);
  const newPending = [...topPending];
  const landings: Landing[] = [];
  const blockedIndices: number[] = [];

  for (let i = 0; i < newPending.length; i++) {
    const col = PENDING_COL_START + i;
    const tileVal = newPending[i];
    if (tileVal === 0) continue;

    let topmost = -1;
    for (let r = 0; r < ROWS; r++) {
      if (newGrid[r][col] !== 0) {
        topmost = r;
        break;
      }
    }

    if (topmost === -1) {
      newGrid[CENTER_ROW][col] = tileVal;
      landings.push({ pendingIdx: i, row: CENTER_ROW, col, merged: false });
    } else if (topmost > 0) {
      newGrid[topmost - 1][col] = tileVal;
      landings.push({ pendingIdx: i, row: topmost - 1, col, merged: false });
    } else {
      blockedIndices.push(i);
      continue;
    }

    newPending[i] = randTileSideExcluding(i > 0 ? newPending[i - 1] : -1);
  }

  return { grid: newGrid, pending: newPending, landings, blockedIndices };
}

export function pushFromBottom(grid: Grid, bottomPending: number[], cfg: GridCfg = DEFAULT_CFG): PushResult {
  const { ROWS, PENDING_COL_START, CENTER_ROW, CENTER_COL } = cfg;
  const newGrid = grid.map((row) => [...row]);
  const newPending = [...bottomPending];
  const landings: Landing[] = [];
  const blockedIndices: number[] = [];

  for (let i = 0; i < newPending.length; i++) {
    const col = PENDING_COL_START + i;
    const tileVal = newPending[i];
    if (tileVal === 0) continue;

    let bottommost = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (newGrid[r][col] !== 0) {
        bottommost = r;
        break;
      }
    }

    if (bottommost === -1) {
      newGrid[CENTER_ROW][col] = tileVal;
      landings.push({ pendingIdx: i, row: CENTER_ROW, col, merged: false });
    } else if (bottommost < ROWS - 1) {
      newGrid[bottommost + 1][col] = tileVal;
      landings.push({ pendingIdx: i, row: bottommost + 1, col, merged: false });
    } else {
      blockedIndices.push(i);
      continue;
    }

    newPending[i] = randTileSideExcluding(i > 0 ? newPending[i - 1] : -1);
  }

  return { grid: newGrid, pending: newPending, landings, blockedIndices };
}

// Merge post-processing moves into their corresponding while-loop moves when they
// represent the same tile continuing its journey (A→B in the loop, B→C in post-processing
// → net move A→C). Within a single while-loop pass every move is a distinct tile, so
// chaining must only happen across the phase boundary, never within a single phase.
function consolidateCrossPhase(mainMoves: Move[], postMoves: Move[]): Move[] {
  const destToIdx = new Map<string, number>();
  const result = mainMoves.map((m) => ({ ...m }));
  for (let i = 0; i < result.length; i++) {
    destToIdx.set(`${result[i].toRow},${result[i].toCol},${result[i].value}`, i);
  }
  for (const m of postMoves) {
    const fromKey = `${m.fromRow},${m.fromCol},${m.value}`;
    if (destToIdx.has(fromKey)) {
      const prevIdx = destToIdx.get(fromKey)!;
      destToIdx.delete(fromKey);
      result[prevIdx] = { ...result[prevIdx], toRow: m.toRow, toCol: m.toCol };
      destToIdx.set(`${m.toRow},${m.toCol},${m.value}`, prevIdx);
    } else {
      result.push({ ...m });
    }
  }
  return result.filter((m) => m.fromRow !== m.toRow || m.fromCol !== m.toCol);
}

export function collapseGrid(
  grid: Grid,
  cfg: GridCfg = DEFAULT_CFG,
  lastVerticalSide: 'top' | 'bottom' = 'top',
  lastHorizontalSide: 'left' | 'right' = 'left'
): CollapseResult {
  const { ROWS, COLS, CENTER_COL, CENTER_ROW } = cfg;
  const newGrid = grid.map((row) => [...row]);
  const gravityWhileMoves: Move[] = [];
  const gravityPostMoves: Move[] = [];
  const horizontalWhileMoves: Move[] = [];
  const horizontalPostMoves: Move[] = [];

  // Phase 1: gravity toward CENTER_ROW — always runs before horizontal.
  // Corner cells are immovable obstacles: excluded from tile lists and never zeroed.
  while (true) {
    const moves: Move[] = [];
    for (let c = 0; c < COLS; c++) {
      const colSnapshot = newGrid.map((row) => row[c]);

      if (lastVerticalSide === 'bottom') {
        // Bottom claims CENTER_ROW
        {
          const tiles: { r: number; v: number }[] = [];
          for (let r = CENTER_ROW; r < ROWS; r++) {
            if (colSnapshot[r] !== 0 && !isCornerCell(r, c, cfg)) tiles.push({ r, v: colSnapshot[r] });
          }
          if (tiles.length > 0) {
            const already = tiles.every((t, i) => t.r === CENTER_ROW + i);
            if (!already) {
              for (let r = CENTER_ROW; r < ROWS; r++) { if (!isCornerCell(r, c, cfg)) newGrid[r][c] = 0; }
              let dest = CENTER_ROW;
              for (const { r: from, v } of tiles) {
                newGrid[dest][c] = v;
                if (from !== dest) moves.push({ value: v, fromRow: from, fromCol: c, toRow: dest, toCol: c });
                dest++;
              }
            }
          }
        }
        {
          const tiles: { r: number; v: number }[] = [];
          for (let r = 0; r < CENTER_ROW; r++) {
            if (colSnapshot[r] !== 0 && !isCornerCell(r, c, cfg)) tiles.push({ r, v: colSnapshot[r] });
          }
          if (tiles.length > 0) {
            let topmostBottomTile = ROWS;
            for (let r = CENTER_ROW; r < ROWS; r++) {
              if (newGrid[r][c] !== 0 && !isCornerCell(r, c, cfg)) { topmostBottomTile = r; break; }
            }
            let destEnd = Math.min(CENTER_ROW - 1, topmostBottomTile - 1);
            destEnd = Math.max(destEnd, tiles.length - 1);
            const already = tiles.every((t, i) => t.r === destEnd - tiles.length + 1 + i);
            if (!already) {
              for (let r = 0; r < CENTER_ROW; r++) { if (!isCornerCell(r, c, cfg)) newGrid[r][c] = 0; }
              let dest = destEnd - tiles.length + 1;
              for (const { r: from, v } of tiles) {
                newGrid[dest][c] = v;
                if (from !== dest) moves.push({ value: v, fromRow: from, fromCol: c, toRow: dest, toCol: c });
                dest++;
              }
            }
          }
        }
      } else {
        // Top claims CENTER_ROW
        {
          const tiles: { r: number; v: number }[] = [];
          for (let r = 0; r <= CENTER_ROW; r++) {
            if (colSnapshot[r] !== 0 && !isCornerCell(r, c, cfg)) tiles.push({ r, v: colSnapshot[r] });
          }
          if (tiles.length > 0) {
            const already = tiles.every((t, i) => t.r === CENTER_ROW + 1 - tiles.length + i);
            if (!already) {
              for (let r = 0; r <= CENTER_ROW; r++) { if (!isCornerCell(r, c, cfg)) newGrid[r][c] = 0; }
              let dest = CENTER_ROW + 1 - tiles.length;
              for (const { r: from, v } of tiles) {
                newGrid[dest][c] = v;
                if (from !== dest) moves.push({ value: v, fromRow: from, fromCol: c, toRow: dest, toCol: c });
                dest++;
              }
            }
          }
        }
        {
          const tiles: { r: number; v: number }[] = [];
          for (let r = CENTER_ROW + 1; r < ROWS; r++) {
            if (colSnapshot[r] !== 0 && !isCornerCell(r, c, cfg)) tiles.push({ r, v: colSnapshot[r] });
          }
          if (tiles.length > 0) {
            let bottommostTopTile = -1;
            for (let r = CENTER_ROW; r >= 0; r--) {
              if (newGrid[r][c] !== 0 && !isCornerCell(r, c, cfg)) { bottommostTopTile = r; break; }
            }
            let destStart = Math.max(CENTER_ROW + 1, bottommostTopTile + 1);
            destStart = Math.min(destStart, ROWS - tiles.length);
            const already = tiles.every((t, i) => t.r === destStart + i);
            if (!already) {
              for (let r = CENTER_ROW + 1; r < ROWS; r++) { if (!isCornerCell(r, c, cfg)) newGrid[r][c] = 0; }
              let dest = destStart;
              for (const { r: from, v } of tiles) {
                newGrid[dest][c] = v;
                if (from !== dest) moves.push({ value: v, fromRow: from, fromCol: c, toRow: dest, toCol: c });
                dest++;
              }
            }
          }
        }
      }
    }
    gravityWhileMoves.push(...moves);
    if (moves.length === 0) break;
  }

  // Post-processing: ensure CENTER_ROW is filled in any column that has live non-corner tiles
  for (let c = 0; c < COLS; c++) {
    const hasLive = newGrid.some((row, r) => row[c] !== 0 && !isCornerCell(r, c, cfg));
    if (!hasLive) continue;
    if (newGrid[CENTER_ROW][c] !== 0) continue;

    let topmost = -1, bottommost = -1;
    for (let r = 0; r < ROWS; r++) {
      if (newGrid[r][c] !== 0 && !isCornerCell(r, c, cfg)) {
        if (topmost === -1) topmost = r;
        bottommost = r;
      }
    }
    if (bottommost < CENTER_ROW) {
      const tiles: number[] = [], fromRows: number[] = [];
      for (let r = topmost; r <= bottommost; r++) {
        if (newGrid[r][c] !== 0 && !isCornerCell(r, c, cfg)) { tiles.push(newGrid[r][c]); fromRows.push(r); }
        if (!isCornerCell(r, c, cfg)) newGrid[r][c] = 0;
      }
      let dest = CENTER_ROW + 1 - tiles.length;
      for (let i = 0; i < tiles.length; i++) {
        newGrid[dest][c] = tiles[i];
        if (fromRows[i] !== dest) gravityPostMoves.push({ value: tiles[i], fromRow: fromRows[i], fromCol: c, toRow: dest, toCol: c });
        dest++;
      }
    } else if (topmost > CENTER_ROW) {
      const tiles: number[] = [], fromRows: number[] = [];
      for (let r = topmost; r <= bottommost; r++) {
        if (newGrid[r][c] !== 0 && !isCornerCell(r, c, cfg)) { tiles.push(newGrid[r][c]); fromRows.push(r); }
        if (!isCornerCell(r, c, cfg)) newGrid[r][c] = 0;
      }
      let dest = CENTER_ROW;
      for (let i = 0; i < tiles.length; i++) {
        newGrid[dest][c] = tiles[i];
        if (fromRows[i] !== dest) gravityPostMoves.push({ value: tiles[i], fromRow: fromRows[i], fromCol: c, toRow: dest, toCol: c });
        dest++;
      }
    }
  }

  // Snapshot after gravity, before horizontal — needed for staged animation
  const midGrid = newGrid.map((row) => [...row]);

  // Phase 2: horizontal collapse toward CENTER_COL.
  // Corner cells are again excluded from movement.
  while (true) {
    const moves: Move[] = [];
    for (let r = 0; r < ROWS; r++) {
      const rowSnapshot = [...newGrid[r]];

      if (lastHorizontalSide === 'left') {
        // Left claims CENTER_COL
        {
          const tiles: { c: number; v: number }[] = [];
          for (let c = 0; c <= CENTER_COL; c++) {
            if (rowSnapshot[c] !== 0 && !isCornerCell(r, c, cfg)) tiles.push({ c, v: rowSnapshot[c] });
          }
          if (tiles.length > 0) {
            const already = tiles.every((t, i) => t.c === CENTER_COL + 1 - tiles.length + i);
            if (!already) {
              for (let c = 0; c <= CENTER_COL; c++) { if (!isCornerCell(r, c, cfg)) newGrid[r][c] = 0; }
              let dest = CENTER_COL + 1 - tiles.length;
              for (const { c: from, v } of tiles) {
                newGrid[r][dest] = v;
                if (from !== dest) moves.push({ value: v, fromRow: r, fromCol: from, toRow: r, toCol: dest });
                dest++;
              }
            }
          }
        }
        {
          const tiles: { c: number; v: number }[] = [];
          for (let c = CENTER_COL + 1; c < COLS; c++) {
            if (rowSnapshot[c] !== 0 && !isCornerCell(r, c, cfg)) tiles.push({ c, v: rowSnapshot[c] });
          }
          if (tiles.length > 0) {
            let rightmostLeftTile = -1;
            for (let c = CENTER_COL; c >= 0; c--) {
              if (newGrid[r][c] !== 0 && !isCornerCell(r, c, cfg)) { rightmostLeftTile = c; break; }
            }
            let destStart = Math.max(CENTER_COL + 1, rightmostLeftTile + 1);
            destStart = Math.min(destStart, COLS - tiles.length);
            const already = tiles.every((t, i) => t.c === destStart + i);
            if (!already) {
              for (let c = CENTER_COL + 1; c < COLS; c++) { if (!isCornerCell(r, c, cfg)) newGrid[r][c] = 0; }
              let dest = destStart;
              for (const { c: from, v } of tiles) {
                newGrid[r][dest] = v;
                if (from !== dest) moves.push({ value: v, fromRow: r, fromCol: from, toRow: r, toCol: dest });
                dest++;
              }
            }
          }
        }
      } else {
        // Right claims CENTER_COL
        {
          const tiles: { c: number; v: number }[] = [];
          for (let c = CENTER_COL; c < COLS; c++) {
            if (rowSnapshot[c] !== 0 && !isCornerCell(r, c, cfg)) tiles.push({ c, v: rowSnapshot[c] });
          }
          if (tiles.length > 0) {
            const already = tiles.every((t, i) => t.c === CENTER_COL + i);
            if (!already) {
              for (let c = CENTER_COL; c < COLS; c++) { if (!isCornerCell(r, c, cfg)) newGrid[r][c] = 0; }
              let dest = CENTER_COL;
              for (const { c: from, v } of tiles) {
                newGrid[r][dest] = v;
                if (from !== dest) moves.push({ value: v, fromRow: r, fromCol: from, toRow: r, toCol: dest });
                dest++;
              }
            }
          }
        }
        {
          const tiles: { c: number; v: number }[] = [];
          for (let c = 0; c < CENTER_COL; c++) {
            if (rowSnapshot[c] !== 0 && !isCornerCell(r, c, cfg)) tiles.push({ c, v: rowSnapshot[c] });
          }
          if (tiles.length > 0) {
            let leftmostRightTile = COLS;
            for (let c = CENTER_COL; c < COLS; c++) {
              if (newGrid[r][c] !== 0 && !isCornerCell(r, c, cfg)) { leftmostRightTile = c; break; }
            }
            let destEnd = Math.min(CENTER_COL, leftmostRightTile - 1);
            destEnd = Math.max(destEnd, tiles.length - 1);
            const already = tiles.every((t, i) => t.c === destEnd - tiles.length + 1 + i);
            if (!already) {
              for (let c = 0; c < CENTER_COL; c++) { if (!isCornerCell(r, c, cfg)) newGrid[r][c] = 0; }
              let dest = destEnd - tiles.length + 1;
              for (const { c: from, v } of tiles) {
                newGrid[r][dest] = v;
                if (from !== dest) moves.push({ value: v, fromRow: r, fromCol: from, toRow: r, toCol: dest });
                dest++;
              }
            }
          }
        }
      }
    }
    horizontalWhileMoves.push(...moves);
    if (moves.length === 0) break;
  }

  // Post-processing: ensure CENTER_COL is filled in any row that has live non-corner tiles
  for (let r = 0; r < ROWS; r++) {
    const hasLive = newGrid[r].some((v, c) => v !== 0 && !isCornerCell(r, c, cfg));
    if (!hasLive) continue;
    if (newGrid[r][CENTER_COL] !== 0) continue;

    let leftmost = -1, rightmost = -1;
    for (let c = 0; c < COLS; c++) {
      if (newGrid[r][c] !== 0 && !isCornerCell(r, c, cfg)) {
        if (leftmost === -1) leftmost = c;
        rightmost = c;
      }
    }
    if (rightmost < CENTER_COL) {
      const tiles: number[] = [], fromCols: number[] = [];
      for (let c = leftmost; c <= rightmost; c++) {
        if (newGrid[r][c] !== 0 && !isCornerCell(r, c, cfg)) { tiles.push(newGrid[r][c]); fromCols.push(c); }
        if (!isCornerCell(r, c, cfg)) newGrid[r][c] = 0;
      }
      let dest = CENTER_COL + 1 - tiles.length;
      for (let i = 0; i < tiles.length; i++) {
        newGrid[r][dest] = tiles[i];
        if (fromCols[i] !== dest) horizontalPostMoves.push({ value: tiles[i], fromRow: r, fromCol: fromCols[i], toRow: r, toCol: dest });
        dest++;
      }
    } else if (leftmost > CENTER_COL) {
      const tiles: number[] = [], fromCols: number[] = [];
      for (let c = leftmost; c <= rightmost; c++) {
        if (newGrid[r][c] !== 0 && !isCornerCell(r, c, cfg)) { tiles.push(newGrid[r][c]); fromCols.push(c); }
        if (!isCornerCell(r, c, cfg)) newGrid[r][c] = 0;
      }
      let dest = CENTER_COL;
      for (let i = 0; i < tiles.length; i++) {
        newGrid[r][dest] = tiles[i];
        if (fromCols[i] !== dest) horizontalPostMoves.push({ value: tiles[i], fromRow: r, fromCol: fromCols[i], toRow: r, toCol: dest });
        dest++;
      }
    }
  }

  return {
    grid: newGrid,
    midGrid,
    gravityMoves: consolidateCrossPhase(gravityWhileMoves, gravityPostMoves),
    horizontalMoves: consolidateCrossPhase(horizontalWhileMoves, horizontalPostMoves),
  };
}

export function annihilateAdjacent(grid: Grid, cfg: GridCfg = DEFAULT_CFG): AnnihilateResult {
  const { ROWS, COLS } = cfg;
  const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const toAnnihilate: [number, number][] = [];
  let score = 0;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (visited[r][c] || grid[r][c] === 0) continue;

      const value = grid[r][c];
      const group: [number, number][] = [];
      const queue: [number, number][] = [[r, c]];
      visited[r][c] = true;

      while (queue.length > 0) {
        const [cr, cc] = queue.shift()!;
        group.push([cr, cc]);
        for (const [dr, dc] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ] as [number, number][]) {
          const nr = cr + dr,
            nc = cc + dc;
          if (
            nr >= 0 &&
            nr < ROWS &&
            nc >= 0 &&
            nc < COLS &&
            !visited[nr][nc] &&
            grid[nr][nc] === value
          ) {
            visited[nr][nc] = true;
            queue.push([nr, nc]);
          }
        }
      }

      if (group.length >= 2) {
        toAnnihilate.push(...group);
        score += group.length * value;
      }
    }
  }

  if (toAnnihilate.length === 0) return { grid, annihilatedCells: [], score: 0 };

  const newGrid = grid.map((row) => [...row]);
  for (const [r, c] of toAnnihilate) newGrid[r][c] = 0;
  return { grid: newGrid, annihilatedCells: toAnnihilate, score };
}

// Returns true if pushing from this side would land at least one tile (non-flythrough).
function sideHasLanding(
  grid: Grid,
  cfg: GridCfg,
  pushFn: (grid: Grid, pending: number[], cfg: GridCfg) => PushResult
): boolean {
  const dummy = Array(cfg.PENDING_SIZE).fill(1) as number[];
  const result = pushFn(grid, dummy, cfg);
  return result.landings.some((l) => !l.flyThrough);
}

export function checkGameOver(grid: Grid, cfg: GridCfg): boolean {
  return (
    !sideHasLanding(grid, cfg, pushFromLeft) &&
    !sideHasLanding(grid, cfg, pushFromRight) &&
    !sideHasLanding(grid, cfg, pushFromTop) &&
    !sideHasLanding(grid, cfg, pushFromBottom)
  );
}

export const MAX_COMBO = 5;
export const NUKE_COMBO = 6;
export function nextCombo(combo: number): number {
  return Math.min(combo + 1, NUKE_COMBO);
}

// Returns the cells and raw score for the center-cross nuke (center row + center col).
// score should be multiplied by MAX_COMBO by the caller.
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

export function getTileColor(value: number): TileColor {
  const colors: Record<number, TileColor> = {
    0: { bg: '#272744', text: 'transparent' },
    1: { bg: '#4488ee', text: '#fff' }, // blue
    2: { bg: '#22bbaa', text: '#fff' }, // teal
    3: { bg: '#44cc66', text: '#fff' }, // green
    4: { bg: '#99cc22', text: '#fff' }, // yellow-green
    5: { bg: '#ffcc00', text: '#222' }, // yellow
    6: { bg: '#ff8822', text: '#fff' }, // orange
    7: { bg: '#ff4422', text: '#fff' }, // red-orange
    8: { bg: '#dd1144', text: '#fff' }, // red
    9: { bg: '#cc1188', text: '#fff' }, // magenta
    10: { bg: '#8822cc', text: '#fff' }, // purple
  };
  return colors[value] ?? { bg: '#fff', text: '#333' };
}
