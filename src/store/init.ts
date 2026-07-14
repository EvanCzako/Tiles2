import type { Grid, GridCfg, GridMode, Direction, GameState, GameStore } from '../types';
import {
  GRID_CONFIGS,
  createInitialGrid,
  createInitialPending,
  pushFromLeft,
  pushFromRight,
  pushFromTop,
  pushFromBottom,
} from '../game';
import { getLayout } from '../layout';
import { AUTO_MOVE_MS } from '../constants';
import { loadHighScore, loadColorPalette, loadSoundOn } from './persistence';

export function initState(mode: GridMode = '9x9'): GameState {
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

// The player still has a meaningful alternative to swiping: an armed nuke.
// While true, the single-direction auto-move must not fire — the "forced"
// swipe isn't actually forced.
export function canUseAbility(s: { nukeArmed: boolean }): boolean {
  return s.nukeArmed;
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
