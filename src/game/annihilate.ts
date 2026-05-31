import type { Grid, GridCfg, AnnihilateResult } from '../types';
import { DEFAULT_CFG } from './config';

// Groups of 2–3: annihilate just that group.
// Groups of 4+: annihilate every tile of that value anywhere on the board (including corners).
export function annihilateAdjacent(grid: Grid, cfg: GridCfg = DEFAULT_CFG): AnnihilateResult {
  const { ROWS, COLS } = cfg;
  const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

  const boardWipeValues = new Set<number>();
  // "r,c" keys of the triggering 4+ group cells, for fast spread/group distinction
  const boardWipeGroupKeySet = new Set<string>();
  const boardWipeGroupCells: [number, number][] = [];
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

      if (group.length >= 3) {
        boardWipeValues.add(value);
        for (const [gr, gc] of group) {
          boardWipeGroupKeySet.add(`${gr},${gc}`);
          boardWipeGroupCells.push([gr, gc]);
        }
      } else if (group.length >= 2) {
        const prev = smallGroupsByValue.get(value) ?? [];
        smallGroupsByValue.set(value, [...prev, ...group]);
      }
    }
  }

  const toAnnihilate: [number, number][] = [];
  const boardWipeSpreadCells: [number, number][] = [];
  const regularCells: [number, number][] = [];
  let score = 0;

  // Board-wide sweep for values with a 4+ connected group
  if (boardWipeValues.size > 0) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] !== 0 && boardWipeValues.has(grid[r][c])) {
          toAnnihilate.push([r, c]);
          score += grid[r][c];
          if (!boardWipeGroupKeySet.has(`${r},${c}`)) {
            boardWipeSpreadCells.push([r, c]);
          }
        }
      }
    }
  }

  // Small groups whose value wasn't upgraded to a board-wide wipe
  for (const [value, cells] of smallGroupsByValue) {
    if (!boardWipeValues.has(value)) {
      toAnnihilate.push(...cells);
      regularCells.push(...cells);
      score += cells.length * value;
    }
  }

  if (toAnnihilate.length === 0) {
    return { grid, annihilatedCells: [], score: 0, boardWipeGroupCells: [], boardWipeSpreadCells: [], regularCells: [] };
  }

  const newGrid = grid.map((row) => [...row]);
  for (const [r, c] of toAnnihilate) newGrid[r][c] = 0;
  return { grid: newGrid, annihilatedCells: toAnnihilate, score, boardWipeGroupCells, boardWipeSpreadCells, regularCells };
}
