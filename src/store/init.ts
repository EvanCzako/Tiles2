import type {
  Grid,
  GridCfg,
  GridMode,
  Layout,
  Direction,
  VerticalSide,
  HorizontalSide,
  FlyingSource,
  FlyingTileDescriptor,
  FrozenPendingRows,
  PendingCommit,
} from '../types';
import { GRID_CONFIGS, createInitialGrid, createInitialPending } from '../game';
import { getLayout } from '../layout';
import { loadHighScore } from './persistence';
import {
  pushFromLeft,
  pushFromRight,
  pushFromTop,
  pushFromBottom,
} from '../game';

export interface InitState {
  gridMode: GridMode;
  cfg: GridCfg;
  layout: Layout;
  grid: Grid;
  leftPending: number[];
  rightPending: number[];
  topPending: number[];
  bottomPending: number[];
  score: number;
  highScore: number;
  combo: number;
  gameOver: boolean;
  animating: boolean;
  flyingTiles: FlyingTileDescriptor[];
  flyingSource: FlyingSource;
  annihilateSet: Set<string>;
  boardWipeFlashSet: Set<string>;
  nukeFlashSet: Set<string>;
  nukeActive: boolean;
  collapsingCells: Set<string>;
  pendingCommit: PendingCommit | null;
  frozenPendingRows: FrozenPendingRows | null;
  lastVerticalSide: VerticalSide;
  lastHorizontalSide: HorizontalSide;
}

export function initState(mode: GridMode = '9x9'): InitState {
  const cfg = GRID_CONFIGS[mode];
  const layout = getLayout(cfg);
  return {
    gridMode: mode,
    cfg,
    layout,
    grid: createInitialGrid(cfg),
    leftPending: createInitialPending(cfg),
    rightPending: createInitialPending(cfg),
    topPending: createInitialPending(cfg),
    bottomPending: createInitialPending(cfg),
    score: 0,
    highScore: loadHighScore(mode),
    combo: 1,
    gameOver: false,
    animating: false,
    flyingTiles: [],
    flyingSource: null,
    annihilateSet: new Set(),
    boardWipeFlashSet: new Set(),
    nukeFlashSet: new Set(),
    nukeActive: false,
    collapsingCells: new Set(),
    pendingCommit: null,
    frozenPendingRows: null,
    lastVerticalSide: 'top',
    lastHorizontalSide: 'left',
  };
}

export function buildFrozenSnapshot(grid: Grid, cfg: GridCfg): FrozenPendingRows {
  const { PENDING_SIZE, PENDING_ROW_START, PENDING_COL_START, CENTER_ROW, CENTER_COL } = cfg;
  const gridEmpty = grid.every((row) => row.every((v) => v === 0));
  const centerRowIdx = CENTER_ROW - PENDING_ROW_START;
  const centerColIdx = CENTER_COL - PENDING_COL_START;
  const rowActive = (i: number) =>
    grid[PENDING_ROW_START + i].some((v) => v !== 0) || (gridEmpty && i === centerRowIdx);
  const colActive = (i: number) =>
    grid.some((row) => row[PENDING_COL_START + i] !== 0) || (gridEmpty && i === centerColIdx);
  return {
    left: Array.from({ length: PENDING_SIZE }, (_, i) => rowActive(i)),
    right: Array.from({ length: PENDING_SIZE }, (_, i) => rowActive(i)),
    top: Array.from({ length: PENDING_SIZE }, (_, i) => colActive(i)),
    bottom: Array.from({ length: PENDING_SIZE }, (_, i) => colActive(i)),
  };
}

export function getAvailableDirections(s: { grid: Grid; cfg: GridCfg }): Direction[] {
  const { grid, cfg } = s;
  const dummy = Array(cfg.PENDING_SIZE).fill(1) as number[];
  const anyLanding = (r: { landings: { flyThrough?: boolean }[] }) =>
    r.landings.some((l) => !l.flyThrough);
  const dirs: Direction[] = [];
  if (anyLanding(pushFromLeft(grid, dummy, cfg))) dirs.push('right');
  if (anyLanding(pushFromRight(grid, dummy, cfg))) dirs.push('left');
  if (anyLanding(pushFromTop(grid, dummy, cfg))) dirs.push('down');
  if (anyLanding(pushFromBottom(grid, dummy, cfg))) dirs.push('up');
  return dirs;
}
