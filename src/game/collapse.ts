import type { Grid, GridCfg, Move, CollapseResult } from '../types';
import { DEFAULT_CFG } from './config';
import { isCornerCell } from './corners';

// Merge post-processing moves into their corresponding while-loop moves when they represent
// the same tile continuing its journey (A→B in loop, B→C in post → net A→C).
// Within a single while-loop pass every move is a distinct tile, so chaining only happens
// across the phase boundary, never within a single phase.
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

  // Phase 1: gravity toward CENTER_ROW — corner cells are immovable obstacles
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

  // Post-processing: ensure CENTER_ROW is filled in any column with live non-corner tiles
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

  const midGrid = newGrid.map((row) => [...row]);

  // Phase 2: horizontal collapse toward CENTER_COL — corner cells excluded
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

  // Post-processing: ensure CENTER_COL is filled in any row with live non-corner tiles
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
