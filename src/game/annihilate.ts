import type { Grid, GridCfg, AnnihilateResult } from '../types';
import { DEFAULT_CFG } from './config';

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
