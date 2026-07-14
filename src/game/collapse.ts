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

// Merge a sequence of move *batches* (each batch = one single-axis pass) into net per-tile moves —
// e.g. A→B in one pass followed by B→C in a later pass (same value passing through the same cell)
// becomes a single A→C move. Needed because obstacles (stones/corners) can make a tile's journey
// span several vertical/horizontal sub-passes; without this the animation would show it
// teleporting mid-flight.
//
// Matching is by (position, value), so it operates one batch at a time: within a single pass every
// move is a distinct tile, and two different same-value tiles can coincidentally have one's
// destination equal another's origin (packLine clears a segment before refilling it) — chaining
// those together would wrongly fuse two tiles into one. So a batch's own moves are only checked
// against *earlier* batches, and only added to the lookup map once the whole batch is done.
function consolidateBatches(batches: Move[][]): Move[] {
  const destToIdx = new Map<string, number>();
  const result: Move[] = [];
  for (const batch of batches) {
    const touched: number[] = [];
    for (const m of batch) {
      const fromKey = `${m.fromRow},${m.fromCol},${m.value}`;
      const existingIdx = destToIdx.get(fromKey);
      if (existingIdx !== undefined) {
        destToIdx.delete(fromKey);
        result[existingIdx] = { ...result[existingIdx], toRow: m.toRow, toCol: m.toCol };
        touched.push(existingIdx);
      } else {
        result.push({ ...m });
        touched.push(result.length - 1);
      }
    }
    for (const idx of touched) {
      const mv = result[idx];
      destToIdx.set(`${mv.toRow},${mv.toCol},${mv.value}`, idx);
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

  // Gravity toward CENTER_ROW. The claiming side packs first and wins CENTER_ROW; the other side
  // then packs against it. If the claiming side leaves CENTER_ROW empty (no tiles, or an obstacle
  // blocks them from reaching it), the other side is allowed to fill CENTER_ROW.
  function verticalPass(sink: Move[]): void {
    for (let c = 0; c < COLS; c++) {
      const get = (r: number) => newGrid[r][c];
      const set = (r: number, v: number) => { newGrid[r][c] = v; };
      const isWall = (r: number) => isObstacle(r, c, newGrid[r][c], cfg);
      const onMove = (from: number, to: number, v: number) =>
        sink.push({ value: v, fromRow: from, fromCol: c, toRow: to, toCol: c });

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
  }

  // Horizontal collapse toward CENTER_COL — same claim/barrier rules on each row.
  function horizontalPass(sink: Move[]): void {
    for (let r = 0; r < ROWS; r++) {
      const get = (c: number) => newGrid[r][c];
      const set = (c: number, v: number) => { newGrid[r][c] = v; };
      const isWall = (c: number) => isObstacle(r, c, newGrid[r][c], cfg);
      const onMove = (from: number, to: number, v: number) =>
        sink.push({ value: v, fromRow: r, fromCol: from, toRow: r, toCol: to });

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
  }

  // Stage 1 (animated first): the initial vertical drop.
  const gravityMoves: Move[] = [];
  verticalPass(gravityMoves);
  const midGrid = newGrid.map((row) => [...row]);

  // Stage 2 (animated second): horizontal settle, plus as many extra vertical/horizontal passes
  // as needed to fully resolve the board. A single vertical+horizontal pass isn't always enough
  // once obstacles (stones/corners) are involved — e.g. a tile that slides into a column via the
  // horizontal pass may now have room to drop further in that column, which only a follow-up
  // vertical pass reveals. Keep alternating until a full pass moves nothing, so no tile is left
  // floating short of where it should settle.
  const restBatches: Move[][] = [];
  const initialHorizontal: Move[] = [];
  horizontalPass(initialHorizontal);
  restBatches.push(initialHorizontal);
  for (let guard = 0; guard < ROWS + COLS; guard++) {
    const extraVertical: Move[] = [];
    verticalPass(extraVertical);
    const extraHorizontal: Move[] = [];
    horizontalPass(extraHorizontal);
    if (extraVertical.length === 0 && extraHorizontal.length === 0) break;
    restBatches.push(extraVertical, extraHorizontal);
  }

  return { grid: newGrid, midGrid, gravityMoves, horizontalMoves: consolidateBatches(restBatches) };
}
