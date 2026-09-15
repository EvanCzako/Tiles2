import type { GridCfg, GridMode } from '../types';

// Keyed by GridMode, not string: a new board or a typo'd key is then a compile
// error instead of a silent `undefined` (or, worse, a silent fall back to 9x9
// difficulty — see BOARD_VALUE_COUNTS / BOARD_STONE_SCALE in tiles.ts).
//
// There are deliberately no top-level ROWS/COLS/CENTER_* constants here. They
// used to exist, hardcoded to 9x9, and nothing but the tests imported them —
// any `import { ROWS } from '../game'` would silently have been wrong on 7x7
// and 11x11. Everything takes its dimensions from a GridCfg.
export const GRID_CONFIGS: Record<GridMode, GridCfg> = {
  '7x7': {
    ROWS: 7,
    COLS: 7,
    PENDING_SIZE: 3,
    PENDING_ROW_START: 2,
    PENDING_COL_START: 2,
    CENTER_COL: 3,
    CENTER_ROW: 3,
  },
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

export const DEFAULT_CFG = GRID_CONFIGS['9x9'];
