export const ROWS = 9;
export const COLS = 9;
export const PENDING_SIZE = 5;          // all four sides: 5 slots each
export const CENTER_COL = Math.floor(COLS / 2); // 4
export const CENTER_ROW = Math.floor(ROWS / 2); // 4
export const PENDING_ROW_START = CENTER_ROW - Math.floor(PENDING_SIZE / 2); // 2
export const PENDING_COL_START = CENTER_COL - Math.floor(PENDING_SIZE / 2); // 2

export const GRID_CONFIGS = {
  '9x9': {
    ROWS: 9, COLS: 9, PENDING_SIZE: 5,
    PENDING_ROW_START: 2, PENDING_COL_START: 2, CENTER_COL: 4, CENTER_ROW: 4,
  },
};

const DEFAULT_CFG = GRID_CONFIGS['9x9'];

export function createInitialGrid(cfg = DEFAULT_CFG) {
  const { ROWS, COLS, PENDING_SIZE, PENDING_COL_START, CENTER_ROW } = cfg;
  const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
  // Diamond centered at (CENTER_ROW, CENTER_COL):
  // PENDING_SIZE wide at center row, tapering by 2 per row above/below
  for (let step = 0, width = PENDING_SIZE; width >= 1; step++, width -= 2) {
    const start = PENDING_COL_START + Math.floor((PENDING_SIZE - width) / 2);
    const fillRow = (r) => {
      if (r >= 0 && r < ROWS) {
        for (let j = 0; j < width; j++) {
          grid[r][start + j] = Math.min(j + 1, width - j);
        }
      }
    };
    fillRow(CENTER_ROW - step);
    if (step > 0) fillRow(CENTER_ROW + step);
  }
  return grid;
}

// Side-panel distribution: heavily favors 1–3, makes 4–7 rare
// 1: ~40%, 2: ~30%, 3: ~18%, 4: ~7%, 5: ~3%, 6: ~1.5%, 7: ~0.5%
function randTileSide() {
  const r = Math.random() * 20;
  if (r < 8)    return 1;
  if (r < 14)   return 2;
  if (r < 17.6) return 3;
  if (r < 19)   return 4;
  if (r < 19.6) return 5;
  if (r < 19.9) return 6;
  return 7;
}

function randTileSideExcluding(exclude) {
  let v;
  do { v = randTileSide(); } while (v === exclude);
  return v;
}

export function createInitialPending(cfg = DEFAULT_CFG) {
  const arr = [];
  for (let i = 0; i < cfg.PENDING_SIZE; i++)
    arr.push(randTileSideExcluding(arr[i - 1] ?? -1));
  return arr;
}

export function createInitialTopPending(cfg = DEFAULT_CFG) {
  const arr = [];
  for (let i = 0; i < cfg.PENDING_SIZE; i++)
    arr.push(randTileSideExcluding(arr[i - 1] ?? -1));
  return arr;
}

function collide(moving, stationary) {
  return null;
}

export function pushFromLeft(grid, leftPending, cfg = DEFAULT_CFG) {
  const { COLS, PENDING_SIZE, PENDING_ROW_START, CENTER_ROW, CENTER_COL } = cfg;
  const newGrid = grid.map(row => [...row]);
  const newPending = [...leftPending];
  const mergedCells = [];
  const landings = [];
  const blockedIndices = [];
  let score = 0;

  const rowLeftmost = [];
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
      if (row === CENTER_ROW) {
        newGrid[row][CENTER_COL] = tileVal;
        landings.push({ pendingIdx: i, row, col: CENTER_COL, merged: false });
      } else {
        landings.push({ pendingIdx: i, flyThrough: true });
      }
    } else {
      const result = collide(tileVal, newGrid[row][leftmost]);
      if (result !== null) {
        score += result === 0 ? tileVal + newGrid[row][leftmost] : tileVal;
        newGrid[row][leftmost] = result;
        mergedCells.push([row, leftmost]);
        landings.push({ pendingIdx: i, row, col: leftmost, merged: true });
      } else if (leftmost > 0) {
        newGrid[row][leftmost - 1] = tileVal;
        landings.push({ pendingIdx: i, row, col: leftmost - 1, merged: false });
      } else {
        blockedIndices.push(i);
        continue;
      }
    }

    newPending[i] = randTileSideExcluding(i > 0 ? newPending[i - 1] : -1);
  }

  return { grid: newGrid, pending: newPending, mergedCells, landings, blockedIndices, score };
}

export function pushFromRight(grid, rightPending, cfg = DEFAULT_CFG) {
  const { COLS, PENDING_SIZE, PENDING_ROW_START, CENTER_ROW, CENTER_COL } = cfg;
  const newGrid = grid.map(row => [...row]);
  const newPending = [...rightPending];
  const mergedCells = [];
  const landings = [];
  const blockedIndices = [];
  let score = 0;

  const rowRightmost = [];
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
      if (row === CENTER_ROW) {
        newGrid[row][CENTER_COL] = tileVal;
        landings.push({ pendingIdx: i, row, col: CENTER_COL, merged: false });
      } else {
        landings.push({ pendingIdx: i, flyThrough: true });
      }
    } else {
      const result = collide(tileVal, newGrid[row][rightmost]);
      if (result !== null) {
        score += result === 0 ? tileVal + newGrid[row][rightmost] : tileVal;
        newGrid[row][rightmost] = result;
        mergedCells.push([row, rightmost]);
        landings.push({ pendingIdx: i, row, col: rightmost, merged: true });
      } else if (rightmost < COLS - 1) {
        newGrid[row][rightmost + 1] = tileVal;
        landings.push({ pendingIdx: i, row, col: rightmost + 1, merged: false });
      } else {
        blockedIndices.push(i);
        continue;
      }
    }

    newPending[i] = randTileSideExcluding(i > 0 ? newPending[i - 1] : -1);
  }

  return { grid: newGrid, pending: newPending, mergedCells, landings, blockedIndices, score };
}

export function pushFromTop(grid, topPending, cfg = DEFAULT_CFG) {
  const { ROWS, PENDING_COL_START, CENTER_ROW, CENTER_COL } = cfg;
  const newGrid = grid.map(row => [...row]);
  const newPending = [...topPending];
  const mergedCells = [];
  const landings = [];
  const blockedIndices = [];
  let score = 0;

  for (let i = 0; i < newPending.length; i++) {
    const col = PENDING_COL_START + i;
    const tileVal = newPending[i];
    if (tileVal === 0) continue;

    let topmost = -1;
    for (let r = 0; r < ROWS; r++) {
      if (newGrid[r][col] !== 0) { topmost = r; break; }
    }

    if (topmost === -1) {
      if (col === CENTER_COL) {
        newGrid[CENTER_ROW][col] = tileVal;
        landings.push({ pendingIdx: i, row: CENTER_ROW, col, merged: false });
      } else {
        landings.push({ pendingIdx: i, flyThrough: true });
      }
    } else {
      const result = collide(tileVal, newGrid[topmost][col]);
      if (result !== null) {
        score += result === 0 ? tileVal + newGrid[topmost][col] : tileVal;
        newGrid[topmost][col] = result;
        mergedCells.push([topmost, col]);
        landings.push({ pendingIdx: i, row: topmost, col, merged: true });
      } else if (topmost > 0) {
        newGrid[topmost - 1][col] = tileVal;
        landings.push({ pendingIdx: i, row: topmost - 1, col, merged: false });
      } else {
        blockedIndices.push(i);
        continue;
      }
    }

    newPending[i] = randTileSideExcluding(i > 0 ? newPending[i - 1] : -1);
  }

  return { grid: newGrid, pending: newPending, mergedCells, landings, blockedIndices, score };
}

export function pushFromBottom(grid, bottomPending, cfg = DEFAULT_CFG) {
  const { ROWS, PENDING_COL_START, CENTER_ROW, CENTER_COL } = cfg;
  const newGrid = grid.map(row => [...row]);
  const newPending = [...bottomPending];
  const mergedCells = [];
  const landings = [];
  const blockedIndices = [];
  let score = 0;

  for (let i = 0; i < newPending.length; i++) {
    const col = PENDING_COL_START + i;
    const tileVal = newPending[i];
    if (tileVal === 0) continue;

    let bottommost = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (newGrid[r][col] !== 0) { bottommost = r; break; }
    }

    if (bottommost === -1) {
      if (col === CENTER_COL) {
        newGrid[CENTER_ROW][col] = tileVal;
        landings.push({ pendingIdx: i, row: CENTER_ROW, col, merged: false });
      } else {
        landings.push({ pendingIdx: i, flyThrough: true });
      }
    } else {
      const result = collide(tileVal, newGrid[bottommost][col]);
      if (result !== null) {
        score += result === 0 ? tileVal + newGrid[bottommost][col] : tileVal;
        newGrid[bottommost][col] = result;
        mergedCells.push([bottommost, col]);
        landings.push({ pendingIdx: i, row: bottommost, col, merged: true });
      } else if (bottommost < ROWS - 1) {
        newGrid[bottommost + 1][col] = tileVal;
        landings.push({ pendingIdx: i, row: bottommost + 1, col, merged: false });
      } else {
        blockedIndices.push(i);
        continue;
      }
    }

    newPending[i] = randTileSideExcluding(i > 0 ? newPending[i - 1] : -1);
  }

  return { grid: newGrid, pending: newPending, mergedCells, landings, blockedIndices, score };
}

// Collapse multi-step chains (A→B then B→C) into net moves (A→C).
// This prevents ghost FlyingTile animations starting from intermediate positions.
function consolidateMoves(moves) {
  // Keys include value so different tiles that happen to share a position
  // are never incorrectly chained (e.g. tile A lands where tile B started).
  const destToIdx = new Map(); // "toRow,toCol,value" → index in result
  const result = [];
  for (const m of moves) {
    const fromKey = `${m.fromRow},${m.fromCol},${m.value}`;
    const toKey   = `${m.toRow},${m.toCol},${m.value}`;
    if (destToIdx.has(fromKey)) {
      // Chain: previous move landed at fromKey, extend it to toKey
      const prevIdx = destToIdx.get(fromKey);
      destToIdx.delete(fromKey);
      result[prevIdx] = { ...result[prevIdx], toRow: m.toRow, toCol: m.toCol };
      destToIdx.set(toKey, prevIdx);
    } else {
      destToIdx.set(toKey, result.length);
      result.push({ ...m });
    }
  }
  return result.filter(m => m.fromRow !== m.toRow || m.fromCol !== m.toCol);
}

export function collapseGrid(grid, cfg = DEFAULT_CFG, lastPushedSide = 'left') {
  const { ROWS, COLS, CENTER_COL, CENTER_ROW } = cfg;
  const newGrid = grid.map(row => [...row]);
  const gravityMoves = [];
  const horizontalMoves = [];

  // Phase 1: gravity toward CENTER_ROW — always runs before horizontal
  while (true) {
    const moves = [];
    for (let c = 0; c < COLS; c++) {
      const colSnapshot = newGrid.map(row => row[c]);

      if (lastPushedSide === 'bottom') {
        // Bottom claims CENTER_ROW
        // Bottom tiles (rows CENTER_ROW..ROWS-1): pack upward to CENTER_ROW
        {
          const tiles = [];
          for (let r = CENTER_ROW; r < ROWS; r++) {
            if (colSnapshot[r] !== 0) tiles.push({ r, v: colSnapshot[r] });
          }
          if (tiles.length > 0) {
            const already = tiles.every((t, i) => t.r === CENTER_ROW + i);
            if (!already) {
              for (let r = CENTER_ROW; r < ROWS; r++) newGrid[r][c] = 0;
              let dest = CENTER_ROW;
              for (const { r: from, v } of tiles) {
                newGrid[dest][c] = v;
                if (from !== dest) moves.push({ value: v, fromRow: from, fromCol: c, toRow: dest, toCol: c });
                dest++;
              }
            }
          }
        }
        // Top tiles (rows 0..CENTER_ROW-1): pack downward, stay ≤ CENTER_ROW-1
        {
          const tiles = [];
          for (let r = 0; r < CENTER_ROW; r++) {
            if (colSnapshot[r] !== 0) tiles.push({ r, v: colSnapshot[r] });
          }
          if (tiles.length > 0) {
            let topmostBottomTile = ROWS;
            for (let r = CENTER_ROW; r < ROWS; r++) {
              if (newGrid[r][c] !== 0) { topmostBottomTile = r; break; }
            }
            let destEnd = Math.min(CENTER_ROW - 1, topmostBottomTile - 1);
            destEnd = Math.max(destEnd, tiles.length - 1);
            const already = tiles.every((t, i) => t.r === destEnd - tiles.length + 1 + i);
            if (!already) {
              for (let r = 0; r < CENTER_ROW; r++) newGrid[r][c] = 0;
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
        // Top claims CENTER_ROW (lastPushedSide is 'top', 'left', or 'right')
        // Top tiles (rows 0..CENTER_ROW): pack downward to CENTER_ROW
        {
          const tiles = [];
          for (let r = 0; r <= CENTER_ROW; r++) {
            if (colSnapshot[r] !== 0) tiles.push({ r, v: colSnapshot[r] });
          }
          if (tiles.length > 0) {
            const already = tiles.every((t, i) => t.r === CENTER_ROW + 1 - tiles.length + i);
            if (!already) {
              for (let r = 0; r <= CENTER_ROW; r++) newGrid[r][c] = 0;
              let dest = CENTER_ROW + 1 - tiles.length;
              for (const { r: from, v } of tiles) {
                newGrid[dest][c] = v;
                if (from !== dest) moves.push({ value: v, fromRow: from, fromCol: c, toRow: dest, toCol: c });
                dest++;
              }
            }
          }
        }
        // Bottom tiles (rows CENTER_ROW+1..ROWS-1): pack upward, stay ≥ CENTER_ROW+1
        {
          const tiles = [];
          for (let r = CENTER_ROW + 1; r < ROWS; r++) {
            if (colSnapshot[r] !== 0) tiles.push({ r, v: colSnapshot[r] });
          }
          if (tiles.length > 0) {
            let bottommostTopTile = -1;
            for (let r = CENTER_ROW; r >= 0; r--) {
              if (newGrid[r][c] !== 0) { bottommostTopTile = r; break; }
            }
            let destStart = Math.max(CENTER_ROW + 1, bottommostTopTile + 1);
            destStart = Math.min(destStart, ROWS - tiles.length);
            const already = tiles.every((t, i) => t.r === destStart + i);
            if (!already) {
              for (let r = CENTER_ROW + 1; r < ROWS; r++) newGrid[r][c] = 0;
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
    gravityMoves.push(...moves);
    if (moves.length === 0) break;
  }

  // Post-processing: ensure CENTER_ROW is filled in any column that has live tiles
  for (let c = 0; c < COLS; c++) {
    const hasLive = newGrid.some(row => row[c] !== 0);
    if (!hasLive) continue;
    if (newGrid[CENTER_ROW][c] !== 0) continue;

    let topmost = -1, bottommost = -1;
    for (let r = 0; r < ROWS; r++) {
      if (newGrid[r][c] !== 0) {
        if (topmost === -1) topmost = r;
        bottommost = r;
      }
    }
    // All tiles above CENTER_ROW: slide down to fill CENTER_ROW
    if (bottommost < CENTER_ROW) {
      const tiles = [], fromRows = [];
      for (let r = topmost; r <= bottommost; r++) {
        if (newGrid[r][c] !== 0) { tiles.push(newGrid[r][c]); fromRows.push(r); }
        newGrid[r][c] = 0;
      }
      let dest = CENTER_ROW + 1 - tiles.length;
      for (let i = 0; i < tiles.length; i++) {
        newGrid[dest][c] = tiles[i];
        if (fromRows[i] !== dest) gravityMoves.push({ value: tiles[i], fromRow: fromRows[i], fromCol: c, toRow: dest, toCol: c });
        dest++;
      }
    }
    // All tiles below CENTER_ROW: slide up to fill CENTER_ROW
    else if (topmost > CENTER_ROW) {
      const tiles = [], fromRows = [];
      for (let r = topmost; r <= bottommost; r++) {
        if (newGrid[r][c] !== 0) { tiles.push(newGrid[r][c]); fromRows.push(r); }
        newGrid[r][c] = 0;
      }
      let dest = CENTER_ROW;
      for (let i = 0; i < tiles.length; i++) {
        newGrid[dest][c] = tiles[i];
        if (fromRows[i] !== dest) gravityMoves.push({ value: tiles[i], fromRow: fromRows[i], fromCol: c, toRow: dest, toCol: c });
        dest++;
      }
    }
  }

  // Snapshot after gravity, before horizontal — needed for staged animation
  const midGrid = newGrid.map(row => [...row]);

  // Phase 2: horizontal (inward) to stability — runs only after gravity is settled
  // The most recently pushed side gets priority for the center column
  while (true) {
    const moves = [];
    for (let r = 0; r < ROWS; r++) {
      const rowSnapshot = [...newGrid[r]];

      if (lastPushedSide === 'left') {
        // Left side pushes right toward the center and can occupy CENTER_COL
        {
          const tiles = [];
          for (let c = 0; c <= CENTER_COL; c++) {
            if (rowSnapshot[c] !== 0) tiles.push({ c, v: rowSnapshot[c] });
          }
          if (tiles.length > 0) {
            const already = tiles.every((t, i) => t.c === CENTER_COL + 1 - tiles.length + i);
            if (!already) {
              for (let c = 0; c <= CENTER_COL; c++) newGrid[r][c] = 0;
              let dest = CENTER_COL + 1 - tiles.length;
              for (const { c: from, v } of tiles) {
                newGrid[r][dest] = v;
                if (from !== dest) moves.push({ value: v, fromRow: r, fromCol: from, toRow: r, toCol: dest });
                dest++;
              }
            }
          }
        }

        // Right side packs left but stays right of left tiles (never goes below CENTER_COL + 1)
        {
          const tiles = [];
          for (let c = CENTER_COL + 1; c < COLS; c++) {
            if (rowSnapshot[c] !== 0) tiles.push({ c, v: rowSnapshot[c] });
          }
          if (tiles.length > 0) {
            let rightmostLeftTile = -1;
            for (let c = CENTER_COL; c >= 0; c--) {
              if (newGrid[r][c] !== 0) { rightmostLeftTile = c; break; }
            }
            // Right side tiles always stay at CENTER_COL + 1 or right, never fill gaps on left
            // Also clamp to not overhang the right edge
            let destStart = Math.max(CENTER_COL + 1, rightmostLeftTile + 1);
            destStart = Math.min(destStart, COLS - tiles.length);
            const already = tiles.every((t, i) => t.c === destStart + i);
            if (!already) {
              for (let c = CENTER_COL + 1; c < COLS; c++) newGrid[r][c] = 0;
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
        // Right side pushes left toward the center and can occupy CENTER_COL
        {
          const tiles = [];
          for (let c = CENTER_COL; c < COLS; c++) {
            if (rowSnapshot[c] !== 0) tiles.push({ c, v: rowSnapshot[c] });
          }
          if (tiles.length > 0) {
            const already = tiles.every((t, i) => t.c === CENTER_COL + i);
            if (!already) {
              for (let c = CENTER_COL; c < COLS; c++) newGrid[r][c] = 0;
              let dest = CENTER_COL;
              for (const { c: from, v } of tiles) {
                newGrid[r][dest] = v;
                if (from !== dest) moves.push({ value: v, fromRow: r, fromCol: from, toRow: r, toCol: dest });
                dest++;
              }
            }
          }
        }

        // Left side packs right but stays left of right tiles (never goes above CENTER_COL)
        {
          const tiles = [];
          for (let c = 0; c < CENTER_COL; c++) {
            if (rowSnapshot[c] !== 0) tiles.push({ c, v: rowSnapshot[c] });
          }
          if (tiles.length > 0) {
            let leftmostRightTile = COLS;
            for (let c = CENTER_COL; c < COLS; c++) {
              if (newGrid[r][c] !== 0) { leftmostRightTile = c; break; }
            }
            // Left side tiles always stay at CENTER_COL or left, never fill gaps on right
            // Also clamp to not go below column 0
            let destEnd = Math.min(CENTER_COL, leftmostRightTile - 1);
            destEnd = Math.max(destEnd, tiles.length - 1);
            const already = tiles.every((t, i) => t.c === destEnd - tiles.length + 1 + i);
            if (!already) {
              for (let c = 0; c < CENTER_COL; c++) newGrid[r][c] = 0;
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
    horizontalMoves.push(...moves);
    if (moves.length === 0) break;
  }

  // Post-processing: ensure if a row has live tiles, CENTER_COL is filled
  for (let r = 0; r < ROWS; r++) {
    const hasLive = newGrid[r].some(v => v !== 0);
    if (!hasLive) continue;
    
    if (newGrid[r][CENTER_COL] !== 0) continue; // Already filled
    
    // Find leftmost and rightmost tiles in the row
    let leftmost = -1, rightmost = -1;
    for (let c = 0; c < COLS; c++) {
      if (newGrid[r][c] !== 0) {
        if (leftmost === -1) leftmost = c;
        rightmost = c;
      }
    }
    
    // If all tiles are on the left, slide right to fill CENTER_COL
    if (rightmost < CENTER_COL) {
      const tiles = [];
      const fromCols = [];
      for (let c = leftmost; c <= rightmost; c++) {
        if (newGrid[r][c] !== 0) {
          tiles.push(newGrid[r][c]);
          fromCols.push(c);
        }
        newGrid[r][c] = 0;
      }
      let dest = CENTER_COL + 1 - tiles.length;
      for (let i = 0; i < tiles.length; i++) {
        const v = tiles[i];
        const fromCol = fromCols[i];
        newGrid[r][dest] = v;
        if (fromCol !== dest) {
          horizontalMoves.push({ value: v, fromRow: r, fromCol, toRow: r, toCol: dest });
        }
        dest++;
      }
    }
    // If all tiles are on the right, slide left to fill CENTER_COL
    else if (leftmost > CENTER_COL) {
      const tiles = [];
      const fromCols = [];
      for (let c = leftmost; c <= rightmost; c++) {
        if (newGrid[r][c] !== 0) {
          tiles.push(newGrid[r][c]);
          fromCols.push(c);
        }
        newGrid[r][c] = 0;
      }
      let dest = CENTER_COL;
      for (let i = 0; i < tiles.length; i++) {
        const v = tiles[i];
        const fromCol = fromCols[i];
        newGrid[r][dest] = v;
        if (fromCol !== dest) {
          horizontalMoves.push({ value: v, fromRow: r, fromCol, toRow: r, toCol: dest });
        }
        dest++;
      }
    }
  }

  return { grid: newGrid, midGrid, gravityMoves: consolidateMoves(gravityMoves), horizontalMoves: consolidateMoves(horizontalMoves) };
}

export function annihilateAdjacent(grid, cfg = DEFAULT_CFG) {
  const { ROWS, COLS } = cfg;
  const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const toAnnihilate = [];
  let score = 0;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (visited[r][c] || grid[r][c] === 0) continue;

      const value = grid[r][c];
      const group = [];
      const queue = [[r, c]];
      visited[r][c] = true;

      while (queue.length > 0) {
        const [cr, cc] = queue.shift();
        group.push([cr, cc]);
        for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const nr = cr + dr, nc = cc + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !visited[nr][nc] && grid[nr][nc] === value) {
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

  const newGrid = grid.map(row => [...row]);
  for (const [r, c] of toAnnihilate) newGrid[r][c] = 0;
  return { grid: newGrid, annihilatedCells: toAnnihilate, score };
}

export function isDeadCell(r, c) {
  return false;
}

export function getTileColor(value) {
  const colors = {
    0:  { bg: '#1e1e38', text: 'transparent' },
    1:  { bg: '#4488ee', text: '#fff' },  // blue
    2:  { bg: '#22bbaa', text: '#fff' },  // teal
    3:  { bg: '#44cc66', text: '#fff' },  // green
    4:  { bg: '#99cc22', text: '#fff' },  // yellow-green
    5:  { bg: '#ffcc00', text: '#222' },  // yellow
    6:  { bg: '#ff8822', text: '#fff' },  // orange
    7:  { bg: '#ff4422', text: '#fff' },  // red-orange
    8:  { bg: '#dd1144', text: '#fff' },  // red
    9:  { bg: '#cc1188', text: '#fff' },  // magenta
    10: { bg: '#8822cc', text: '#fff' },  // purple
  };
  return colors[value] ?? { bg: '#fff', text: '#333' };
}
