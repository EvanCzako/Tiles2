import type { GridCfg } from '../types';

export const ROWS = 9;
export const COLS = 9;
export const PENDING_SIZE = 5;
export const CENTER_COL = Math.floor(COLS / 2);
export const CENTER_ROW = Math.floor(ROWS / 2);
export const PENDING_ROW_START = CENTER_ROW - Math.floor(PENDING_SIZE / 2);
export const PENDING_COL_START = CENTER_COL - Math.floor(PENDING_SIZE / 2);

export const GRID_CONFIGS: Record<string, GridCfg> = {
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
