import type { GridCfg, TileColor } from '../types';
import { DEFAULT_CFG } from './config';

// 1: ~33%, 2: ~24%, 3: ~16%, 4: ~10%, 5: ~7%, 6: ~6%, 7: ~4%
export function randTileSide(): number {
  const r = Math.random() * 100;
  if (r < 33) return 1;
  if (r < 57) return 2;
  if (r < 73) return 3;
  if (r < 83) return 4;
  if (r < 90) return 5;
  if (r < 96) return 6;
  return 7;
}

export function randTileSideExcluding(exclude: number): number {
  let v: number;
  do { v = randTileSide(); } while (v === exclude);
  return v;
}

export function randTileSideExcluding2(a: number, b: number): number {
  let v: number;
  do { v = randTileSide(); } while (v === a || v === b);
  return v;
}

export function createInitialPending(cfg: GridCfg = DEFAULT_CFG): number[] {
  const arr: number[] = [];
  for (let i = 0; i < cfg.PENDING_SIZE; i++) arr.push(randTileSideExcluding(arr[i - 1] ?? -1));
  return arr;
}

export function getTileColor(value: number): TileColor {
  const colors: Record<number, TileColor> = {
    0: { bg: '#272744', text: 'transparent' },
    1: { bg: '#4488ee', text: '#fff' },
    2: { bg: '#22bbaa', text: '#fff' },
    3: { bg: '#44cc66', text: '#fff' },
    4: { bg: '#99cc22', text: '#fff' },
    5: { bg: '#ffcc00', text: '#222' },
    6: { bg: '#ff8822', text: '#fff' },
    7: { bg: '#ff4422', text: '#fff' },
    8: { bg: '#dd1144', text: '#fff' },
    9: { bg: '#cc1188', text: '#fff' },
    10: { bg: '#8822cc', text: '#fff' },
  };
  return colors[value] ?? { bg: '#fff', text: '#333' };
}
