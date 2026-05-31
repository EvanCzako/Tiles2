import type { Grid, GridCfg, AnnihilateResult } from '../types';
import { DEFAULT_CFG } from './config';

// Groups of 2–3: annihilate just that group.
// Groups of 4+: annihilate every tile of that value anywhere on the board (including corners).
export function annihilateAdjacent(grid: Grid, cfg: GridCfg = DEFAULT_CFG): AnnihilateResult {
  const { ROWS, COLS } = cfg;
  const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

  // values whose connected group hit 4+ → board-wide sweep
  const boardWipeValues = new Set<number>();
  // small-group cells (2–3) keyed by value, to be excluded if value later triggers board-wipe
  const smallGroupsByValue = new Map<number, [number, number][]>();

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
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as [number, number][]) {
          const nr = cr + dr, nc = cc + dc;
          if (
            nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS &&
            !visited[nr][nc] && grid[nr][nc] === value
          ) {
            visited[nr][nc] = true;
            queue.push([nr, nc]);
          }
        }
      }

      if (group.length >= 4) {
        boardWipeValues.add(value);
      } else if (group.length >= 2) {
        const prev = smallGroupsByValue.get(value) ?? [];
        smallGroupsByValue.set(value, [...prev, ...group]);
      }
    }
  }

  const toAnnihilate: [number, number][] = [];
  let score = 0;

  // Board-wide sweep for values with a 4+ connected group
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== 0 && boardWipeValues.has(grid[r][c])) {
        toAnnihilate.push([r, c]);
        score += grid[r][c];
      }
    }
  }

  // Small groups whose value wasn't upgraded to a board-wide wipe
  for (const [value, cells] of smallGroupsByValue) {
    if (!boardWipeValues.has(value)) {
      toAnnihilate.push(...cells);
      score += cells.length * value;
    }
  }

  if (toAnnihilate.length === 0) return { grid, annihilatedCells: [], score: 0 };

  const newGrid = grid.map((row) => [...row]);
  for (const [r, c] of toAnnihilate) newGrid[r][c] = 0;
  return { grid: newGrid, annihilatedCells: toAnnihilate, score };
}
