import {
  ROWS,
  COLS,
  PENDING_SIZE,
  PENDING_ROW_START,
  PENDING_COL_START,
  CENTER_COL,
  CENTER_ROW,
  createInitialGrid,
  createInitialPending,
  pushFromLeft,
  pushFromRight,
  pushFromTop,
  pushFromBottom,
  collapseGrid,
  annihilateAdjacent,
  checkGameOver,
  nextCombo,
  MAX_COMBO,
  NUKE_COMBO,
  nukeCrossScore,
} from './gameLogic.js';
import type { Grid, GridCfg } from './types.js';

// Helper: build a sparse 9×9 grid from a list of [row, col, value] triples.
function makeGrid(entries: [number, number, number][]): Grid {
  const g: Grid = Array(ROWS)
    .fill(null)
    .map(() => Array(COLS).fill(0));
  for (const [r, c, v] of entries) g[r][c] = v;
  return g;
}

// Count non-zero cells.
function tileCount(grid: Grid): number {
  return grid.flat().filter((v) => v !== 0).length;
}

describe('Game Constants', () => {
  test('grid dimensions are 9x9', () => {
    expect(ROWS).toBe(9);
    expect(COLS).toBe(9);
  });

  test('pending row starts at 2 (centered around CENTER_ROW)', () => {
    expect(PENDING_ROW_START).toBe(2);
  });

  test('pending size is 5 (all four sides)', () => {
    expect(PENDING_SIZE).toBe(5);
  });

  test('center column is 4', () => {
    expect(CENTER_COL).toBe(4);
  });

  test('center row is 4', () => {
    expect(CENTER_ROW).toBe(4);
  });
});

describe('Grid Initialization', () => {
  test('createInitialGrid returns 9x9 diamond centered at (CENTER_ROW, CENTER_COL)', () => {
    const grid = createInitialGrid();
    expect(grid.length).toBe(9);
    expect(grid[0].length).toBe(9);

    // Center row (4): full width 5 — cols 2-6
    expect(grid[CENTER_ROW].slice(2, 7)).toEqual([1, 2, 3, 2, 1]);
    // One row above and below center (3, 5): width 3 — cols 3-5
    expect(grid[CENTER_ROW - 1].slice(3, 6)).toEqual([1, 2, 1]);
    expect(grid[CENTER_ROW + 1].slice(3, 6)).toEqual([1, 2, 1]);
    // Two rows above and below center (2, 6): width 1 — col 4
    expect(grid[CENTER_ROW - 2][CENTER_COL]).toBe(1);
    expect(grid[CENTER_ROW + 2][CENTER_COL]).toBe(1);
    // Top and bottom rows: arm cells are empty, corner cells are populated
    expect(grid[0].slice(PENDING_COL_START, PENDING_COL_START + PENDING_SIZE).every((v) => v === 0)).toBe(true);
    expect(grid[8].slice(PENDING_COL_START, PENDING_COL_START + PENDING_SIZE).every((v) => v === 0)).toBe(true);
    expect(grid[0][0]).toBeGreaterThan(0);
    expect(grid[0][COLS - 1]).toBeGreaterThan(0);
  });

  test('createInitialPending returns array of 5 non-repeating tiles for any side', () => {
    const pending = createInitialPending();
    expect(pending.length).toBe(5);
    expect(pending.every((t) => t >= 1 && t <= 7)).toBe(true);
    // No two adjacent tiles should be equal (randTileSideExcluding)
    for (let i = 1; i < pending.length; i++) expect(pending[i]).not.toBe(pending[i - 1]);
  });
});

describe('Push Adjacent Placement', () => {
  test('equal-value tiles: incoming placed adjacent, no annihilation at push time', () => {
    const grid = [
      ...Array(ROWS - 1)
        .fill(null)
        .map(() => Array(COLS).fill(0)),
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
    ] as Grid;
    grid[PENDING_ROW_START][1] = 1;

    const result = pushFromLeft(grid, [1, 0, 0, 0]);
    // equal tiles: no collision merge, tile lands at col 0 (adjacent)
    expect(result.grid[PENDING_ROW_START][1]).toBe(1);
    expect(result.grid[PENDING_ROW_START][0]).toBe(1);
  });

  test('different-value tiles: incoming placed adjacent', () => {
    const grid = [
      ...Array(ROWS - 1)
        .fill(null)
        .map(() => Array(COLS).fill(0)),
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
    ] as Grid;
    grid[PENDING_ROW_START][1] = 3;

    const result = pushFromLeft(grid, [1, 0, 0, 0]);
    // 1 !== 3: no merge, tile lands at col 0 (adjacent)
    expect(result.grid[PENDING_ROW_START][1]).toBe(3);
    expect(result.grid[PENDING_ROW_START][0]).toBe(1);
  });

  test('different-value tiles: larger incoming placed adjacent to smaller', () => {
    const grid = [
      ...Array(ROWS - 1)
        .fill(null)
        .map(() => Array(COLS).fill(0)),
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
    ] as Grid;
    grid[PENDING_ROW_START][1] = 1;

    const result = pushFromLeft(grid, [3, 0, 0, 0]);
    // 3 !== 1: no merge, tile lands at col 0
    expect(result.grid[PENDING_ROW_START][1]).toBe(1);
    expect(result.grid[PENDING_ROW_START][0]).toBe(3);
  });
});

describe('Push From Left', () => {
  test('basic left push places tile adjacent to grid tile', () => {
    const grid: Grid = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0));
    grid[PENDING_ROW_START][2] = 3;

    const result = pushFromLeft(grid, [2, 0, 0, 0]);
    // 2 !== 3: no merge, tile placed at col 1
    expect(result.grid[PENDING_ROW_START][2]).toBe(3);
    expect(result.grid[PENDING_ROW_START][1]).toBe(2);
    expect(result.pending[0]).toBeGreaterThan(0);
  });

  test('left push into empty row lands at CENTER_COL', () => {
    const grid: Grid = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0));

    const result = pushFromLeft(grid, [1, 0, 0, 0]);
    expect(result.landings[0].flyThrough).toBeFalsy();
    expect(result.landings[0].col).toBe(CENTER_COL);
    expect(result.grid[PENDING_ROW_START][CENTER_COL]).toBe(1);
  });
});

describe('Push From Right', () => {
  test('basic right push places tile adjacent to grid tile', () => {
    const grid: Grid = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0));
    grid[PENDING_ROW_START][6] = 3;

    const result = pushFromRight(grid, [2, 0, 0, 0]);
    // 2 !== 3: no merge, tile placed at col 7
    expect(result.grid[PENDING_ROW_START][6]).toBe(3);
    expect(result.grid[PENDING_ROW_START][7]).toBe(2);
  });
});

describe('Push From Top', () => {
  test('top push into empty column lands at CENTER_ROW', () => {
    const grid: Grid = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0));

    const result = pushFromTop(grid, [1, 0, 0, 0, 0]);
    const col = PENDING_COL_START; // column 2
    expect(result.landings[0]?.flyThrough).toBeFalsy();
    expect(result.landings[0]?.row).toBe(CENTER_ROW);
    expect(result.grid[CENTER_ROW][col]).toBe(1);
  });

  test('top push lands on existing tile in column', () => {
    const grid: Grid = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0));
    grid[CENTER_ROW][PENDING_COL_START] = 3;

    const result = pushFromTop(grid, [2, 0, 0, 0, 0]);
    // 2 !== 3: no merge, tile placed at row CENTER_ROW-1
    expect(result.grid[CENTER_ROW][PENDING_COL_START]).toBe(3);
    expect(result.grid[CENTER_ROW - 1][PENDING_COL_START]).toBe(2);
  });
});

describe('Vertical Collapse (Gravity)', () => {
  test('tiles in upper half fall toward CENTER_ROW', () => {
    const grid: Grid = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0));
    grid[0][CENTER_COL] = 1;
    grid[2][CENTER_COL] = 2;

    const result = collapseGrid(grid);
    const col = result.grid.map((row) => row[CENTER_COL]);
    const nonZero = col.filter((v) => v !== 0);
    expect(nonZero).toEqual([1, 2]);
    // Both tiles are in top half and pack downward to CENTER_ROW
    expect(col[CENTER_ROW - 1]).toBe(1);
    expect(col[CENTER_ROW]).toBe(2);
  });

  test('tiles in lower half rise toward CENTER_ROW', () => {
    const grid: Grid = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0));
    grid[6][CENTER_COL] = 3;
    grid[8][CENTER_COL] = 4;

    const result = collapseGrid(grid);
    const col = result.grid.map((row) => row[CENTER_COL]);
    const nonZero = col.filter((v) => v !== 0);
    expect(nonZero).toEqual([3, 4]);
    // Both tiles are in bottom half and pack upward to CENTER_ROW
    expect(col[CENTER_ROW]).toBe(3);
    expect(col[CENTER_ROW + 1]).toBe(4);
  });

  test('tiles from top and bottom pack symmetrically toward CENTER_ROW', () => {
    const grid: Grid = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0));
    grid[0][CENTER_COL] = 1;
    grid[8][CENTER_COL] = 2;

    const result = collapseGrid(grid);
    const col = result.grid.map((row) => row[CENTER_COL]);
    // top tile falls to CENTER_ROW, bottom tile rises to CENTER_ROW+1 or CENTER_ROW-1
    expect(col[CENTER_ROW]).not.toBe(0);
    expect(col.filter((v) => v !== 0).length).toBe(2);
  });
});

describe('Horizontal Collapse (Row Packing)', () => {
  test('left half tiles with gap pack right toward center', () => {
    const grid: Grid = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0));
    grid[CENTER_ROW][0] = 1;
    grid[CENTER_ROW][2] = 2;

    const result = collapseGrid(grid);
    const row = result.grid[CENTER_ROW];
    // With center fill requirement, CENTER_COL should be filled
    expect(row[CENTER_COL]).not.toBe(0);
    expect(row.slice(0, CENTER_COL + 1).filter((v) => v !== 0).length).toBe(2);
  });

  test('right half tiles with gap pack left toward center', () => {
    const grid: Grid = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0));
    grid[CENTER_ROW][6] = 1;
    grid[CENTER_ROW][8] = 2;

    const result = collapseGrid(grid);
    const row = result.grid[CENTER_ROW];
    expect(row[CENTER_COL]).toBe(1);
    expect(row[CENTER_COL + 1]).toBe(2);
  });

  test('right half contiguous tiles with leading center gap pack correctly', () => {
    const grid: Grid = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0));
    grid[CENTER_ROW][CENTER_COL + 1] = 1;
    grid[CENTER_ROW][CENTER_COL + 2] = 2;

    const result = collapseGrid(grid);
    const row = result.grid[CENTER_ROW];
    expect(row[CENTER_COL]).toBe(1);
    expect(row[CENTER_COL + 1]).toBe(2);
    expect(row[CENTER_COL + 2]).toBe(0);
  });

  test('left half contiguous tiles with trailing center gap pack to center', () => {
    const grid: Grid = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0));
    grid[CENTER_ROW][0] = 1;
    grid[CENTER_ROW][1] = 2;

    const result = collapseGrid(grid);
    const row = result.grid[CENTER_ROW];
    // Should pack right and fill CENTER_COL with one of them
    expect(row[CENTER_COL]).not.toBe(0);
  });
});

describe('Cascading Collapse Loop', () => {
  test('gravity then row-packing interact correctly', () => {
    const grid: Grid = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0));
    // These tiles are above center; gravity pulls them to CENTER_ROW
    grid[0][CENTER_COL] = 1;
    grid[1][CENTER_COL - 1] = 2;
    grid[2][CENTER_COL + 1] = 3;

    const result = collapseGrid(grid);
    // After gravity + row packing all three should be packed toward CENTER_COL at CENTER_ROW
    const centerRow = result.grid[CENTER_ROW];
    expect(centerRow.filter((v) => v !== 0).length).toBe(3);
  });

  test('right side row packing does not overwrite or lose tiles', () => {
    const grid: Grid = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0));
    grid[CENTER_ROW][5] = 1;
    grid[CENTER_ROW][7] = 2;
    grid[CENTER_ROW][8] = 3;

    const result = collapseGrid(grid);
    const flatOrig = grid.flat().filter((x) => x !== 0).length;
    const flatResult = result.grid.flat().filter((x) => x !== 0).length;
    expect(flatResult).toBe(flatOrig);

    const row = result.grid[CENTER_ROW];
    expect(row[CENTER_COL]).toBe(1);
    expect(row[CENTER_COL + 1]).toBe(2);
    expect(row[CENTER_COL + 2]).toBe(3);
  });
});

describe('Edge Cases', () => {
  test('empty grid remains empty', () => {
    const grid: Grid = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0));
    const result = collapseGrid(grid);
    expect(result.grid.flat().every((x) => x === 0)).toBe(true);
  });

  test('already collapsed grid produces no moves', () => {
    const grid: Grid = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0));
    // Tiles already at center row, packed toward CENTER_COL
    grid[CENTER_ROW][CENTER_COL - 1] = 1;
    grid[CENTER_ROW][CENTER_COL] = 2;

    const result = collapseGrid(grid);
    expect(result.gravityMoves.length).toBe(0);
    expect(result.horizontalMoves.length).toBe(0);
  });
});

describe('Center Column Fill Requirement', () => {
  test('left-side only tiles are pulled to center to fill CENTER_COL', () => {
    const grid: Grid = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0));
    grid[CENTER_ROW][0] = 1;
    grid[CENTER_ROW][2] = 2;

    const result = collapseGrid(grid);
    const row = result.grid[CENTER_ROW];
    // Row has tiles, so CENTER_COL must be filled
    expect(row[CENTER_COL]).not.toBe(0);
  });

  test('right-side only tiles are pulled to center to fill CENTER_COL', () => {
    const grid: Grid = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0));
    grid[CENTER_ROW][6] = 1;
    grid[CENTER_ROW][8] = 2;

    const result = collapseGrid(grid);
    const row = result.grid[CENTER_ROW];
    // Row has tiles, so CENTER_COL must be filled
    expect(row[CENTER_COL]).not.toBe(0);
  });

  test('single left-side tile moves to center', () => {
    const grid: Grid = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0));
    grid[CENTER_ROW][1] = 5;

    const result = collapseGrid(grid);
    const row = result.grid[CENTER_ROW];
    expect(row[CENTER_COL]).toBe(5);
    expect(row.slice(0, CENTER_COL).every((v) => v === 0)).toBe(true);
  });

  test('single right-side tile moves to center', () => {
    const grid: Grid = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0));
    grid[CENTER_ROW][7] = 3;

    const result = collapseGrid(grid);
    const row = result.grid[CENTER_ROW];
    expect(row[CENTER_COL]).toBe(3);
    expect(row.slice(CENTER_COL + 1).every((v) => v === 0)).toBe(true);
  });

  test('empty rows stay empty (no tiles to fill center)', () => {
    const grid: Grid = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0));
    grid[CENTER_ROW][CENTER_COL] = 1; // center already filled

    const result = collapseGrid(grid);
    // All other rows should be empty
    for (let r = 0; r < ROWS; r++) {
      if (r !== CENTER_ROW) {
        expect(result.grid[r].every((v) => v === 0)).toBe(true);
      }
    }
  });
});

describe('No Overhang Boundary Checks', () => {
  test('full row tiles stay within bounds', () => {
    const grid: Grid = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0));
    for (let i = 0; i < COLS; i++) {
      grid[CENTER_ROW][i] = 1; // Fill entire center row
    }

    const result = collapseGrid(grid);
    const row = result.grid[CENTER_ROW];
    // All tiles should be within bounds
    expect(row.every((_v, i) => i < COLS)).toBe(true);
    // No overhang past COLS-1
    expect(row[COLS]).toBeUndefined();
  });

  test('right-side tiles do not overhang into left half', () => {
    const grid: Grid = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0));
    grid[CENTER_ROW][CENTER_COL + 1] = 1;
    grid[CENTER_ROW][CENTER_COL + 2] = 2;
    grid[CENTER_ROW][CENTER_COL + 3] = 3;

    const result = collapseGrid(grid);
    const row = result.grid[CENTER_ROW];
    // Right side should start at CENTER_COL
    for (let c = 0; c < CENTER_COL; c++) {
      expect(row[c]).toBe(0);
    }
  });

  test('multiple rows collapse without interference', () => {
    const grid: Grid = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0));
    // Center row: mix of left and right tiles
    grid[CENTER_ROW][0] = 1;
    grid[CENTER_ROW][1] = 2;
    grid[CENTER_ROW][7] = 3;
    grid[CENTER_ROW][8] = 4;

    const result = collapseGrid(grid);
    const row1 = result.grid[CENTER_ROW];

    // Verify all 4 tiles are preserved and positioned correctly
    expect(row1.filter((v) => v !== 0).length).toBe(4);
    // Verify no tiles in other rows (gravity already at center)
    for (let r = 0; r < ROWS; r++) {
      if (r !== CENTER_ROW) {
        expect(result.grid[r].every((v) => v === 0)).toBe(true);
      }
    }
  });
});

describe('Complex Cascading Scenarios', () => {
  test('gravity + horizontal + center fill all work together', () => {
    const grid: Grid = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0));
    // Use non-corner positions: top arm and bottom arm of the cross
    grid[0][CENTER_COL] = 1;
    grid[8][CENTER_COL] = 2;

    const result = collapseGrid(grid);
    const centerRow = result.grid[CENTER_ROW];

    // Both should collapse into CENTER_ROW and CENTER_COL should be filled
    expect(centerRow.some((v) => v !== 0)).toBe(true);
    expect(centerRow[CENTER_COL]).not.toBe(0);
  });

  test('row with tile on each side of center stays balanced', () => {
    const grid: Grid = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0));
    grid[CENTER_ROW][CENTER_COL - 1] = 1;
    grid[CENTER_ROW][CENTER_COL] = 5;
    grid[CENTER_ROW][CENTER_COL + 1] = 2;

    const result = collapseGrid(grid);
    const row = result.grid[CENTER_ROW];

    // Tiles should remain with center filled
    expect(row[CENTER_COL]).toBe(5);
    expect([1, 2].includes(row[CENTER_COL - 1]) || [1, 2].includes(row[CENTER_COL + 1])).toBe(true);
  });

  test('prevents tiles from crossing the center boundary', () => {
    const grid: Grid = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0));
    // Center row: left-side at edge, right-side at edge
    grid[CENTER_ROW][0] = 1;
    grid[CENTER_ROW][1] = 2;
    grid[CENTER_ROW][7] = 3;
    grid[CENTER_ROW][8] = 4;

    const result = collapseGrid(grid);
    const row1 = result.grid[CENTER_ROW];

    // Verify tiles exist and didn't cross boundary
    expect(row1.filter((v) => v !== 0).length).toBe(4);

    // Find leftmost and rightmost filled columns
    let leftmost = -1,
      rightmost = -1;
    for (let c = 0; c < COLS; c++) {
      if (row1[c] !== 0) {
        if (leftmost === -1) leftmost = c;
        rightmost = c;
      }
    }

    // Verify positions: leftmost packed toward CENTER_COL, rightmost beyond CENTER_COL
    expect(leftmost).toBeLessThanOrEqual(CENTER_COL);
    expect(rightmost).toBeGreaterThanOrEqual(CENTER_COL);
  });

  test('tile counts are preserved through collapse', () => {
    const grid: Grid = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0));
    grid[1][0] = 1;
    grid[2][3] = 2;
    grid[4][8] = 3;
    grid[CENTER_ROW][CENTER_COL - 1] = 4;
    grid[CENTER_ROW][CENTER_COL + 1] = 5;

    const before = grid.flat().filter((v) => v !== 0).length;
    const result = collapseGrid(grid);
    const after = result.grid.flat().filter((v) => v !== 0).length;

    expect(after).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// Symmetry: no preferential treatment for any side
// ---------------------------------------------------------------------------

describe('Symmetry: no preferential treatment', () => {
  test('vertical: lastVerticalSide=top gives top priority, bottom gives bottom priority', () => {
    const grid = makeGrid([
      [1, CENTER_COL, 1],
      [7, CENTER_COL, 2],
    ]);

    const { grid: gTop } = collapseGrid(grid, undefined, 'top', 'left');
    const { grid: gBot } = collapseGrid(grid, undefined, 'bottom', 'left');

    expect(gTop[CENTER_ROW][CENTER_COL]).toBe(1);
    expect(gTop[CENTER_ROW + 1][CENTER_COL]).toBe(2);

    expect(gBot[CENTER_ROW][CENTER_COL]).toBe(2);
    expect(gBot[CENTER_ROW - 1][CENTER_COL]).toBe(1);
  });

  test('horizontal: lastHorizontalSide=left gives left priority, right gives right priority', () => {
    const grid = makeGrid([
      [CENTER_ROW, 1, 1],
      [CENTER_ROW, 7, 2],
    ]);

    const { grid: gLeft } = collapseGrid(grid, undefined, 'top', 'left');
    const { grid: gRight } = collapseGrid(grid, undefined, 'top', 'right');

    expect(gLeft[CENTER_ROW][CENTER_COL]).toBe(1);
    expect(gLeft[CENTER_ROW][CENTER_COL + 1]).toBe(2);

    expect(gRight[CENTER_ROW][CENTER_COL]).toBe(2);
    expect(gRight[CENTER_ROW][CENTER_COL - 1]).toBe(1);
  });

  test('vertical priority is independent of lastHorizontalSide', () => {
    const grid = makeGrid([
      [1, CENTER_COL, 1],
      [7, CENTER_COL, 2],
    ]);

    const { grid: gA } = collapseGrid(grid, undefined, 'bottom', 'left');
    const { grid: gB } = collapseGrid(grid, undefined, 'bottom', 'right');

    expect(gA[CENTER_ROW][CENTER_COL]).toBe(2);
    expect(gB[CENTER_ROW][CENTER_COL]).toBe(2);
    expect(gA[CENTER_ROW - 1][CENTER_COL]).toBe(1);
    expect(gB[CENTER_ROW - 1][CENTER_COL]).toBe(1);
  });

  test('horizontal priority is independent of lastVerticalSide', () => {
    const grid = makeGrid([
      [CENTER_ROW, 1, 1],
      [CENTER_ROW, 7, 2],
    ]);

    const { grid: gA } = collapseGrid(grid, undefined, 'top', 'right');
    const { grid: gB } = collapseGrid(grid, undefined, 'bottom', 'right');

    expect(gA[CENTER_ROW][CENTER_COL]).toBe(2);
    expect(gB[CENTER_ROW][CENTER_COL]).toBe(2);
    expect(gA[CENTER_ROW][CENTER_COL - 1]).toBe(1);
    expect(gB[CENTER_ROW][CENTER_COL - 1]).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Move Animation Integrity
// ---------------------------------------------------------------------------

describe('Move Animation Integrity — gravity', () => {
  test('[BUG] two different tiles: landing pos of first equals start pos of second — separate moves', () => {
    const grid = makeGrid([
      [0, CENTER_COL, 1],
      [3, CENTER_COL, 2],
    ]);
    const { grid: g, gravityMoves } = collapseGrid(grid);

    expect(g[3][CENTER_COL]).toBe(1);
    expect(g[4][CENTER_COL]).toBe(2);

    const m1 = gravityMoves.find((m) => m.value === 1);
    const m2 = gravityMoves.find((m) => m.value === 2);

    expect(m1).toBeDefined();
    expect(m1!.fromRow).toBe(0);
    expect(m1!.toRow).toBe(3);

    expect(m2).toBeDefined();
    expect(m2!.fromRow).toBe(3);
    expect(m2!.toRow).toBe(4);
  });

  test('[BUG] three-tile column — no false chaining across different values', () => {
    const grid = makeGrid([
      [0, CENTER_COL, 1],
      [2, CENTER_COL, 2],
      [3, CENTER_COL, 3],
    ]);
    const { grid: g, gravityMoves } = collapseGrid(grid);

    expect(g[2][CENTER_COL]).toBe(1);
    expect(g[3][CENTER_COL]).toBe(2);
    expect(g[4][CENTER_COL]).toBe(3);

    const m1 = gravityMoves.find((m) => m.value === 1);
    const m2 = gravityMoves.find((m) => m.value === 2);
    const m3 = gravityMoves.find((m) => m.value === 3);

    expect(m1?.toRow).toBe(2);
    expect(m2?.fromRow).toBe(2);
    expect(m2?.toRow).toBe(3);
    expect(m3?.fromRow).toBe(3);
    expect(m3?.toRow).toBe(4);
  });

  test('[BUG] two same-value tiles in same column: each gets its own gravity move', () => {
    const grid = makeGrid([
      [0, CENTER_COL, 4],
      [3, CENTER_COL, 4],
    ]);
    const { grid: g, gravityMoves } = collapseGrid(grid);

    expect(g[3][CENTER_COL]).toBe(4);
    expect(g[4][CENTER_COL]).toBe(4);
    expect(gravityMoves.length).toBe(2);

    const m1 = gravityMoves.find((m) => m.fromRow === 0);
    const m2 = gravityMoves.find((m) => m.fromRow === 3);
    expect(m1?.toRow).toBe(3);
    expect(m2?.toRow).toBe(4);
  });

  test('[BUG] two same-value tiles in same row: each gets its own horizontal move', () => {
    const grid = makeGrid([
      [CENTER_ROW, 0, 3],
      [CENTER_ROW, 3, 3],
    ]);
    const { grid: g, horizontalMoves } = collapseGrid(grid, undefined, 'top', 'left');

    expect(g[CENTER_ROW][3]).toBe(3);
    expect(g[CENTER_ROW][4]).toBe(3);
    expect(horizontalMoves.length).toBe(2);

    const m1 = horizontalMoves.find((m) => m.fromCol === 0);
    const m2 = horizontalMoves.find((m) => m.fromCol === 3);
    expect(m1?.toCol).toBe(3);
    expect(m2?.toCol).toBe(4);
  });

  test('valid cross-phase chain: same tile moved by while-loop then post-processing merges correctly', () => {
    const grid = makeGrid([[0, CENTER_COL, 3]]);
    const { grid: g, gravityMoves } = collapseGrid(grid, undefined, 'bottom', 'left');

    expect(g[CENTER_ROW][CENTER_COL]).toBe(3);

    const movesForTile = gravityMoves.filter((m) => m.value === 3);
    expect(movesForTile.length).toBe(1);
    expect(movesForTile[0].fromRow).toBe(0);
    expect(movesForTile[0].toRow).toBe(CENTER_ROW);
  });

  test('each of several tiles in separate columns gets its own gravity move', () => {
    const grid = makeGrid([
      [0, 2, 1],
      [1, 3, 2],
      [0, 5, 3],
      [2, 6, 4],
    ]);
    const { gravityMoves } = collapseGrid(grid);

    for (const v of [1, 2, 3, 4]) {
      expect(gravityMoves.find((m) => m.value === v)).toBeDefined();
    }
  });

  test('tile count is preserved after collapse — nothing created or destroyed', () => {
    const grid = makeGrid([
      [0, CENTER_COL - 1, 2],
      [1, CENTER_COL, 5],
      [2, CENTER_COL + 1, 3],
      [7, CENTER_COL - 2, 1],
      [8, CENTER_COL + 2, 4],
    ]);
    const { grid: g } = collapseGrid(grid);
    expect(tileCount(g)).toBe(5);
  });

  test('single tile far above CENTER_ROW produces exactly one gravity move to CENTER_ROW', () => {
    const grid = makeGrid([[0, CENTER_COL, 7]]);
    const { gravityMoves } = collapseGrid(grid);
    expect(gravityMoves.length).toBe(1);
    expect(gravityMoves[0].fromRow).toBe(0);
    expect(gravityMoves[0].toRow).toBe(CENTER_ROW);
  });

  test('single tile far below CENTER_ROW produces exactly one gravity move to CENTER_ROW', () => {
    const grid = makeGrid([[8, CENTER_COL, 6]]);
    const { gravityMoves } = collapseGrid(grid);
    expect(gravityMoves.length).toBe(1);
    expect(gravityMoves[0].fromRow).toBe(8);
    expect(gravityMoves[0].toRow).toBe(CENTER_ROW);
  });

  test('tiles above and below CENTER_ROW both move correctly', () => {
    const grid = makeGrid([
      [1, CENTER_COL, 1],
      [7, CENTER_COL, 2],
    ]);
    const { grid: g, gravityMoves } = collapseGrid(grid);

    expect(g[CENTER_ROW][CENTER_COL]).toBe(1);
    expect(g[CENTER_ROW + 1][CENTER_COL]).toBe(2);

    const m1 = gravityMoves.find((m) => m.value === 1);
    const m2 = gravityMoves.find((m) => m.value === 2);
    expect(m1?.toRow).toBe(CENTER_ROW);
    expect(m2?.toRow).toBe(CENTER_ROW + 1);
  });

  test('column with 4 stacked tiles above CENTER_ROW: all get separate moves', () => {
    const grid = makeGrid([
      [0, CENTER_COL, 1],
      [1, CENTER_COL, 2],
      [2, CENTER_COL, 3],
      [3, CENTER_COL, 4],
    ]);
    const { grid: g, gravityMoves } = collapseGrid(grid);

    expect(g[1][CENTER_COL]).toBe(1);
    expect(g[2][CENTER_COL]).toBe(2);
    expect(g[3][CENTER_COL]).toBe(3);
    expect(g[4][CENTER_COL]).toBe(4);

    expect(gravityMoves.find((m) => m.value === 1)?.toRow).toBe(1);
    expect(gravityMoves.find((m) => m.value === 2)?.toRow).toBe(2);
    expect(gravityMoves.find((m) => m.value === 3)?.toRow).toBe(3);
    expect(gravityMoves.find((m) => m.value === 4)?.toRow).toBe(4);
  });
});

describe('Move Animation Integrity — horizontal', () => {
  test('[BUG] two left-side tiles: landing col of first equals start col of second — separate moves', () => {
    const grid = makeGrid([
      [CENTER_ROW, 0, 1],
      [CENTER_ROW, 3, 2],
    ]);
    const { grid: g, horizontalMoves } = collapseGrid(grid);

    expect(g[CENTER_ROW][3]).toBe(1);
    expect(g[CENTER_ROW][4]).toBe(2);

    const m1 = horizontalMoves.find((m) => m.value === 1);
    const m2 = horizontalMoves.find((m) => m.value === 2);

    expect(m1).toBeDefined();
    expect(m1!.fromCol).toBe(0);
    expect(m1!.toCol).toBe(3);

    expect(m2).toBeDefined();
    expect(m2!.fromCol).toBe(3);
    expect(m2!.toCol).toBe(4);
  });

  test('[BUG] two right-side tiles: landing col of first equals start col of second — separate moves', () => {
    const grid = makeGrid([
      [CENTER_ROW, 8, 1],
      [CENTER_ROW, 5, 2],
    ]);
    const { grid: g, horizontalMoves } = collapseGrid(grid, undefined, 'top', 'right');

    expect(g[CENTER_ROW][5]).toBe(1);
    expect(g[CENTER_ROW][4]).toBe(2);

    const m1 = horizontalMoves.find((m) => m.value === 1);
    const m2 = horizontalMoves.find((m) => m.value === 2);

    expect(m1?.fromCol).toBe(8);
    expect(m1?.toCol).toBe(5);
    expect(m2?.fromCol).toBe(5);
    expect(m2?.toCol).toBe(4);
  });

  test('right-side three-tile chain: no over-merge', () => {
    const grid = makeGrid([
      [CENTER_ROW, 8, 1],
      [CENTER_ROW, 6, 2],
      [CENTER_ROW, 5, 3],
    ]);
    const { grid: g, horizontalMoves } = collapseGrid(grid, undefined, 'top', 'right');

    expect(g[CENTER_ROW][4]).toBe(3);
    expect(g[CENTER_ROW][5]).toBe(2);
    expect(g[CENTER_ROW][6]).toBe(1);

    expect(horizontalMoves.find((m) => m.value === 1)?.toCol).toBe(6);
    expect(horizontalMoves.find((m) => m.value === 2)?.toCol).toBe(5);
    expect(horizontalMoves.find((m) => m.value === 3)?.toCol).toBe(4);
  });

  test('horizontal tile count preserved during row packing', () => {
    const grid = makeGrid([
      [CENTER_ROW, 0, 1],
      [CENTER_ROW, 2, 2],
      [CENTER_ROW, 6, 3],
      [CENTER_ROW, 8, 4],
    ]);
    const { grid: g } = collapseGrid(grid);
    expect(tileCount(g)).toBe(4);
  });
});

describe('Move Animation Integrity — push then collapse', () => {
  test('pushFromLeft + collapseGrid: tile count preserved end-to-end', () => {
    const grid = makeGrid([[CENTER_ROW, CENTER_COL, 5]]);
    const pending = [2, 3, 1, 4, 2];
    const pushed = pushFromLeft(grid, pending);
    const before = tileCount(pushed.grid);
    const { grid: g } = collapseGrid(pushed.grid, undefined, 'top', 'left');
    expect(tileCount(g)).toBe(before);
  });

  test('pushFromTop + collapseGrid: tiles land and gravity settles correctly', () => {
    const baseGrid = makeGrid([[CENTER_ROW, PENDING_COL_START, 2]]);
    const pending = [1, 0, 0, 0, 0];
    const pushed = pushFromTop(baseGrid, pending);
    expect(pushed.landings[0]?.flyThrough).toBeFalsy();
    const { grid: g } = collapseGrid(pushed.grid, undefined, 'top', 'left');
    expect(tileCount(g)).toBeGreaterThan(0);
  });

  test('pushFromBottom + collapseGrid: tiles land and gravity settles correctly', () => {
    const baseGrid = makeGrid([[CENTER_ROW, PENDING_COL_START + 2, 3]]);
    const pending = [0, 0, 1, 0, 0];
    const pushed = pushFromBottom(baseGrid, pending);
    expect(pushed.landings.some((l) => !l.flyThrough)).toBe(true);
    const { grid: g } = collapseGrid(pushed.grid, undefined, 'bottom', 'left');
    expect(tileCount(g)).toBeGreaterThan(0);
  });
});

describe('annihilateAdjacent', () => {
  test('pair of adjacent same-value tiles is annihilated', () => {
    const grid = makeGrid([
      [CENTER_ROW, CENTER_COL, 3],
      [CENTER_ROW, CENTER_COL + 1, 3],
    ]);
    const { grid: g, annihilatedCells, score } = annihilateAdjacent(grid);
    expect(annihilatedCells.length).toBe(2);
    expect(g[CENTER_ROW][CENTER_COL]).toBe(0);
    expect(g[CENTER_ROW][CENTER_COL + 1]).toBe(0);
    expect(score).toBe(6);
  });

  test('single isolated tile is not annihilated', () => {
    const grid = makeGrid([[CENTER_ROW, CENTER_COL, 5]]);
    const { annihilatedCells, score } = annihilateAdjacent(grid);
    expect(annihilatedCells.length).toBe(0);
    expect(score).toBe(0);
  });

  test('L-shaped group of 3 same-value tiles all annihilate', () => {
    const grid = makeGrid([
      [CENTER_ROW, CENTER_COL, 2],
      [CENTER_ROW, CENTER_COL + 1, 2],
      [CENTER_ROW + 1, CENTER_COL, 2],
    ]);
    const { annihilatedCells, score } = annihilateAdjacent(grid);
    expect(annihilatedCells.length).toBe(3);
    expect(score).toBe(6);
  });

  test('two separate pairs of different values both annihilate independently', () => {
    const grid = makeGrid([
      [CENTER_ROW, CENTER_COL, 1],
      [CENTER_ROW, CENTER_COL + 1, 1],
      [CENTER_ROW + 1, CENTER_COL, 3],
      [CENTER_ROW + 1, CENTER_COL + 1, 3],
    ]);
    const { annihilatedCells, score } = annihilateAdjacent(grid);
    expect(annihilatedCells.length).toBe(4);
    expect(score).toBe(2 + 6);
  });

  test('adjacent tiles with different values are not annihilated', () => {
    const grid = makeGrid([
      [CENTER_ROW, CENTER_COL, 1],
      [CENTER_ROW, CENTER_COL + 1, 2],
    ]);
    const { annihilatedCells } = annihilateAdjacent(grid);
    expect(annihilatedCells.length).toBe(0);
  });

  test('empty grid produces no annihilations', () => {
    const grid = makeGrid([]);
    const { annihilatedCells, score } = annihilateAdjacent(grid);
    expect(annihilatedCells.length).toBe(0);
    expect(score).toBe(0);
  });

  // ── 4+ board-wide wipe ───────────────────────────────────────────────────

  test('connected group of exactly 4 triggers board-wide wipe of that value', () => {
    // 4 connected 2s + one isolated 2 elsewhere → all 5 are wiped
    const grid = makeGrid([
      [CENTER_ROW, CENTER_COL,     2],
      [CENTER_ROW, CENTER_COL + 1, 2],
      [CENTER_ROW, CENTER_COL - 1, 2],
      [CENTER_ROW + 1, CENTER_COL, 2],
      [CENTER_ROW - 1, CENTER_COL + 2, 2], // isolated, not connected to the group
    ]);
    const { annihilatedCells, score } = annihilateAdjacent(grid);
    expect(annihilatedCells.length).toBe(5);
    expect(score).toBe(5 * 2);
  });

  test('two separate groups of 2 of the same value do NOT trigger board-wide wipe', () => {
    // two disconnected pairs of value 3 — each pair annihilates as a small group
    const grid = makeGrid([
      [CENTER_ROW, CENTER_COL,     3],
      [CENTER_ROW, CENTER_COL + 1, 3],
      [CENTER_ROW + 2, CENTER_COL, 3],
      [CENTER_ROW + 2, CENTER_COL + 1, 3],
      [CENTER_ROW - 1, CENTER_COL - 1, 3], // isolated — NOT wiped
    ]);
    const { annihilatedCells, score } = annihilateAdjacent(grid);
    // only the two pairs (4 cells) annihilate; the isolated tile survives
    expect(annihilatedCells.length).toBe(4);
    expect(score).toBe(4 * 3);
  });

  test('board-wide wipe scores every matching tile, not just the triggering group', () => {
    // 4 connected 5s in a row, plus two isolated 5s
    const grid = makeGrid([
      [CENTER_ROW, CENTER_COL - 1, 5],
      [CENTER_ROW, CENTER_COL,     5],
      [CENTER_ROW, CENTER_COL + 1, 5],
      [CENTER_ROW, CENTER_COL + 2, 5],
      [CENTER_ROW - 2, CENTER_COL + 2, 5],
      [CENTER_ROW + 2, CENTER_COL - 2, 5],
    ]);
    const { annihilatedCells, score } = annihilateAdjacent(grid);
    expect(annihilatedCells.length).toBe(6);
    expect(score).toBe(6 * 5);
  });

  test('board-wide wipe does not affect tiles of other values', () => {
    const grid = makeGrid([
      [CENTER_ROW, CENTER_COL,     4],
      [CENTER_ROW, CENTER_COL + 1, 4],
      [CENTER_ROW, CENTER_COL + 2, 4],
      [CENTER_ROW, CENTER_COL - 1, 4],
      [CENTER_ROW + 1, CENTER_COL, 7], // different value — should survive
    ]);
    const { grid: g, annihilatedCells } = annihilateAdjacent(grid);
    expect(annihilatedCells.length).toBe(4);
    expect(g[CENTER_ROW + 1][CENTER_COL]).toBe(7);
  });
});

// ── checkGameOver ─────────────────────────────────────────────────────────────

const CFG: GridCfg = {
  ROWS,
  COLS,
  PENDING_SIZE,
  PENDING_ROW_START,
  PENDING_COL_START,
  CENTER_ROW,
  CENTER_COL,
};

describe('checkGameOver', () => {
  test('empty board is NOT game over (center row always lands)', () => {
    const grid = makeGrid([]);
    expect(checkGameOver(grid, CFG)).toBe(false);
  });

  test('center-only tile is NOT game over (push lands adjacent to it)', () => {
    const grid = makeGrid([[CENTER_ROW, CENTER_COL, 1]]);
    expect(checkGameOver(grid, CFG)).toBe(false);
  });

  test('all entry edges occupied → game over', () => {
    const entries: [number, number, number][] = [];
    for (let i = 0; i < PENDING_SIZE; i++) {
      entries.push([PENDING_ROW_START + i, 0, 1]);
      entries.push([PENDING_ROW_START + i, COLS - 1, 1]);
      entries.push([0, PENDING_COL_START + i, 1]);
      entries.push([ROWS - 1, PENDING_COL_START + i, 1]);
    }
    const grid = makeGrid(entries);
    expect(checkGameOver(grid, CFG)).toBe(true);
  });

  test('one entry edge open → NOT game over', () => {
    const entries: [number, number, number][] = [];
    for (let i = 0; i < PENDING_SIZE; i++) {
      entries.push([PENDING_ROW_START + i, 0, 1]);
      entries.push([PENDING_ROW_START + i, COLS - 1, 1]);
      entries.push([0, PENDING_COL_START + i, 1]);
      if (PENDING_COL_START + i !== CENTER_COL) {
        entries.push([ROWS - 1, PENDING_COL_START + i, 1]);
      }
    }
    const grid = makeGrid(entries);
    expect(checkGameOver(grid, CFG)).toBe(false);
  });

  test('packed outer border but inner pending rows open → NOT game over', () => {
    const entries: [number, number, number][] = [];
    for (let r = 0; r < ROWS; r++) {
      if (r < PENDING_ROW_START || r >= PENDING_ROW_START + PENDING_SIZE) {
        entries.push([r, 0, 1], [r, COLS - 1, 1]);
      }
    }
    const grid = makeGrid(entries);
    expect(checkGameOver(grid, CFG)).toBe(false);
  });
});

// ── nukeCrossScore ────────────────────────────────────────────────────────────

describe('nukeCrossScore', () => {
  test('empty grid returns no cells and score 0', () => {
    const { cells, score } = nukeCrossScore(makeGrid([]));
    expect(cells.length).toBe(0);
    expect(score).toBe(0);
  });

  test('tiles only in center row are all collected', () => {
    const grid = makeGrid([
      [CENTER_ROW, 0, 1],
      [CENTER_ROW, 4, 3],
      [CENTER_ROW, 8, 2],
    ]);
    const { cells, score } = nukeCrossScore(grid);
    expect(cells.length).toBe(3);
    expect(score).toBe(1 + 3 + 2);
  });

  test('tiles only in center column are all collected', () => {
    const grid = makeGrid([
      [0, CENTER_COL, 2],
      [3, CENTER_COL, 1],
      [7, CENTER_COL, 4],
    ]);
    const { cells, score } = nukeCrossScore(grid);
    expect(cells.length).toBe(3);
    expect(score).toBe(2 + 1 + 4);
  });

  test('intersection cell (CENTER_ROW, CENTER_COL) counted exactly once', () => {
    const grid = makeGrid([[CENTER_ROW, CENTER_COL, 5]]);
    const { cells, score } = nukeCrossScore(grid);
    expect(cells.length).toBe(1);
    expect(score).toBe(5);
  });

  test('tiles in both center row and col — no double-counting at intersection', () => {
    const grid = makeGrid([
      [CENTER_ROW, 2, 3],
      [CENTER_ROW, CENTER_COL, 2],
      [2, CENTER_COL, 1],
    ]);
    const { cells, score } = nukeCrossScore(grid);
    expect(cells.length).toBe(3);
    expect(score).toBe(3 + 2 + 1);
  });

  test('cells outside the cross are not collected', () => {
    const grid = makeGrid([
      [0, 0, 7],
      [CENTER_ROW, CENTER_COL, 1],
    ]);
    const { cells, score } = nukeCrossScore(grid);
    expect(cells.length).toBe(1);
    expect(score).toBe(1);
  });

  test('fifth cascade reaches NUKE_COMBO — nuke condition', () => {
    expect(nextCombo(5)).toBe(NUKE_COMBO);
    expect(nextCombo(NUKE_COMBO)).toBe(NUKE_COMBO);
  });
});

// ── Combo multiplier ─────────────────────────────────────────────────────────
describe('nextCombo', () => {
  test('starts at 1, first call returns 2', () => {
    expect(nextCombo(1)).toBe(2);
  });

  test('increments correctly: 2 → 3 → 4 → 5 → 6', () => {
    expect(nextCombo(2)).toBe(3);
    expect(nextCombo(3)).toBe(4);
    expect(nextCombo(4)).toBe(5);
    expect(nextCombo(5)).toBe(6);
  });

  test('caps at NUKE_COMBO (6)', () => {
    expect(nextCombo(6)).toBe(6);
    expect(nextCombo(10)).toBe(6);
  });

  test('MAX_COMBO is 5, NUKE_COMBO is 6', () => {
    expect(MAX_COMBO).toBe(5);
    expect(NUKE_COMBO).toBe(6);
  });

  test('cascading three waves: 1x → 2x → 3x', () => {
    let combo = 1;
    combo = nextCombo(combo);
    expect(combo).toBe(2);
    combo = nextCombo(combo);
    expect(combo).toBe(3);
  });

  test('score at 1x: annScore × 1', () => {
    const { score } = annihilateAdjacent(
      makeGrid([
        [CENTER_ROW, CENTER_COL, 3],
        [CENTER_ROW, CENTER_COL + 1, 3],
      ]),
      CFG
    );
    expect(score * 1).toBe(6);
  });

  test('score at 2x: annScore × 2', () => {
    const { score } = annihilateAdjacent(
      makeGrid([
        [CENTER_ROW, CENTER_COL, 3],
        [CENTER_ROW, CENTER_COL + 1, 3],
      ]),
      CFG
    );
    expect(score * 2).toBe(12);
  });

  test('score at 5x (max): annScore × 5', () => {
    const { score } = annihilateAdjacent(
      makeGrid([
        [CENTER_ROW, CENTER_COL, 2],
        [CENTER_ROW, CENTER_COL + 1, 2],
      ]),
      CFG
    );
    expect(score * 5).toBe(20);
  });
});
