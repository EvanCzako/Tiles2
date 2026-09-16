import type { GridMode, GameState } from '../types';
import {
  GRID_CONFIGS,
  createInitialGrid,
  createInitialPending,
  setDifficulty,
} from '../game';
import { getLayout } from '../layout';
import {
  loadHighScore,
  loadColorPalette,
  loadSoundOn,
  loadGridMode,
  loadHapticsOn,
  loadReducedMotion,
  loadStats,
} from './persistence';

// Every call starts a new run. Animation chains started under an older id are
// inert from this point on (see the run guard in store/animations.ts).
let runSeq = 0;

export function initState(mode: GridMode = loadGridMode()): GameState {
  const cfg = GRID_CONFIGS[mode];
  const layout = getLayout(cfg);
  // Reset the difficulty ramp to turn 0 before generating the starting board/pending.
  setDifficulty(0, mode);
  return {
    runId: ++runSeq,
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
    hapticsOn: loadHapticsOn(),
    reducedMotion: loadReducedMotion(),
    stats: loadStats(),
    // Recomputed by the store after init (a fresh run supersedes any save); the
    // menu reads it to decide whether to offer Continue.
    hasSavedRun: false,
  };
}
