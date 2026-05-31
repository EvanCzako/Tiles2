import type { Grid, GridCfg, Move } from '../types';
import { randTileSide } from './tiles';

interface CornerBlockSpec {
  rows: [number, number]; // [innerRow, outerRow]
  cols: [number, number]; // [innerCol, outerCol]
}

export function getCornerBlockSpecs(cfg: GridCfg): CornerBlockSpec[] {
  const { ROWS, COLS, PENDING_ROW_START, PENDING_COL_START } = cfg;
  return [
    { rows: [PENDING_ROW_START - 1, 0],              cols: [PENDING_COL_START - 1, 0] },           // top-left
    { rows: [PENDING_ROW_START - 1, 0],              cols: [COLS - PENDING_COL_START, COLS - 1] },  // top-right
    { rows: [ROWS - PENDING_ROW_START, ROWS - 1],    cols: [PENDING_COL_START - 1, 0] },           // bottom-left
    { rows: [ROWS - PENDING_ROW_START, ROWS - 1],    cols: [COLS - PENDING_COL_START, COLS - 1] }, // bottom-right
  ];
}

export function isCornerCell(r: number, c: number, cfg: GridCfg): boolean {
  const { PENDING_ROW_START, PENDING_SIZE, PENDING_COL_START } = cfg;
  return (
    (r < PENDING_ROW_START || r >= PENDING_ROW_START + PENDING_SIZE) &&
    (c < PENDING_COL_START || c >= PENDING_COL_START + PENDING_SIZE)
  );
}

// Two-phase gravity: vertical first, then horizontal. Returns both move sets for staged animation.
// Refills any remaining empty slots after both phases.
export function settleCorners(
  grid: Grid,
  cfg: GridCfg
): { grid: Grid; movedGrid: Grid; midGrid: Grid; verticalMoves: Move[]; horizontalMoves: Move[] } {
  const midGrid = grid.map((row) => [...row]);
  const verticalMoves: Move[] = [];

  // Phase 1: vertical — slide outer→inner if inner is empty
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

  // Phase 2: horizontal — slide outer→inner if inner is empty
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

  // Snapshot after slides, before refill — used to stage the refill as a separate animation frame
  const movedGrid = settledGrid.map((row) => [...row]);

  // Refill remaining empty slots inner-to-outer so adjacency exclusion sees placed neighbours
  for (const { rows, cols } of getCornerBlockSpecs(cfg)) {
    for (const r of rows) {
      for (const c of cols) {
        if (settledGrid[r][c] !== 0) continue;
        const excluded = new Set<number>();
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as [number, number][]) {
          const nr = r + dr, nc = c + dc;
          if (
            nr >= 0 && nr < cfg.ROWS && nc >= 0 && nc < cfg.COLS &&
            isCornerCell(nr, nc, cfg) && settledGrid[nr][nc] !== 0
          ) excluded.add(settledGrid[nr][nc]);
        }
        let v: number;
        do { v = randTileSide(); } while (excluded.has(v));
        settledGrid[r][c] = v;
      }
    }
  }

  return { grid: settledGrid, movedGrid, midGrid, verticalMoves, horizontalMoves };
}
