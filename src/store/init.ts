import type {
  Grid,
  GridCfg,
  GridMode,
  PaletteId,
  Layout,
  Direction,
  VerticalSide,
  HorizontalSide,
  FlyingSource,
  FlyingTileDescriptor,
  FrozenPendingRows,
  PendingCommit,
  ScorePopup,
  ShakeState,
  Announcement,
  GameStore,
} from '../types';
import { GRID_CONFIGS, createInitialGrid, createInitialPending, NUKE_CHARGE_MAX } from '../game';
import { getLayout } from '../layout';
import { AUTO_MOVE_MS } from '../constants';
import { loadHighScore, loadColorPalette, loadSoundOn } from './persistence';
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
  bombFlashSet: Set<string>;
  nukeFlashSet: Set<string>;
  nukeActive: boolean;
  collapsingCells: Set<string>;
  pendingCommit: PendingCommit | null;
  frozenPendingRows: FrozenPendingRows | null;
  lastVerticalSide: VerticalSide;
  lastHorizontalSide: HorizontalSide;
  colorPalette: PaletteId;
  nukeCharge: number;
  rerollArmed: boolean;
  turnsUntilReroll: number;
  turnClearedTiles: number;
  cleanSweepAwarded: boolean;
  scorePopups: ScorePopup[];
  shake: ShakeState | null;
  announcement: Announcement | null;
  soundOn: boolean;
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
    bombFlashSet: new Set(),
    nukeFlashSet: new Set(),
    nukeActive: false,
    collapsingCells: new Set(),
    pendingCommit: null,
    frozenPendingRows: null,
    lastVerticalSide: 'top',
    lastHorizontalSide: 'left',
    colorPalette: loadColorPalette(),
    nukeCharge: 0,
    rerollArmed: false,
    turnsUntilReroll: 0,
    turnClearedTiles: 0,
    cleanSweepAwarded: false,
    scorePopups: [],
    shake: null,
    announcement: null,
    soundOn: loadSoundOn(),
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

// The player still has a meaningful alternative to swiping: a charged nuke or
// a ready strip reroll. While true, the single-direction auto-move must not
// fire — the "forced" swipe isn't actually forced.
export function canUseAbility(s: { nukeCharge: number; turnsUntilReroll: number }): boolean {
  return s.nukeCharge >= NUKE_CHARGE_MAX || s.turnsUntilReroll === 0;
}

// Auto-push the only available direction after a short delay — but only when
// the player truly has no other option. Re-checked at fire time in case an
// ability became usable (or a turn started) while the timer was pending.
export function scheduleAutoMoveIfForced(get: () => GameStore): void {
  const s = get();
  const available = getAvailableDirections(s);
  if (available.length !== 1 || canUseAbility(s)) return;
  setTimeout(() => {
    const cur = get();
    if (!cur.gameOver && !cur.animating && !canUseAbility(cur)) cur.triggerPush(available[0]);
  }, AUTO_MOVE_MS);
}
