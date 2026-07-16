import type { Grid, GridCfg, GridMode, Direction, GameState } from '../types';
import {
  GRID_CONFIGS,
  createInitialGrid,
  createInitialPending,
  pushFromLeft,
  pushFromRight,
  pushFromTop,
  pushFromBottom,
  setDifficulty,
} from '../game';
import { getLayout } from '../layout';
import { loadHighScore, loadColorPalette, loadSoundOn } from './persistence';

export function initState(mode: GridMode = '9x9'): GameState {
  const cfg = GRID_CONFIGS[mode];
  const layout = getLayout(cfg);
  // Reset the difficulty ramp to turn 0 before generating the starting board/pending.
  setDifficulty(0);
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
    turnCount: 0,
    gameOver: false,
    animating: false,
    flyingTiles: [],
    flyingSource: null,
    annihilateSet: new Set(),
    boardWipeFlashSet: new Set(),
    bombFlashSet: new Set(),
    nukeFlashSet: new Set(),
    collapsingCells: new Set(),
    pendingCommit: null,
    lastVerticalSide: 'top',
    lastHorizontalSide: 'left',
    colorPalette: loadColorPalette(),
    nukeCharge: 0,
    nukeArmed: false,
    turnClearedTiles: 0,
    cleanSweepAwarded: false,
    scorePopups: [],
    shake: null,
    announcement: null,
    soundOn: loadSoundOn(),
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

// Kept for callers that gate UI on whether the player has an ability available
// (e.g. suppressing hints). Auto-move was removed, so nothing schedules on it.
export function canUseAbility(s: { nukeArmed: boolean }): boolean {
  return s.nukeArmed;
}
