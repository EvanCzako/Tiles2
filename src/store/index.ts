import { create } from 'zustand';
import type {
  Grid,
  GridCfg,
  GridMode,
  Direction,
  VerticalSide,
  HorizontalSide,
  PendingKey,
  FlyingTileDescriptor,
  FlyingSource,
  GameStore,
} from '../types';
import { ANIM_MS } from '../constants';
import {
  cellPos,
  leftPendingPos,
  rightPendingPos,
  topPendingPos,
  bottomPendingPos,
} from '../layout';
import {
  pushFromLeft,
  pushFromRight,
  pushFromTop,
  pushFromBottom,
  checkGameOver,
  setDifficulty,
  NUKE_DECAY_PER_PUSH,
} from '../game';
import { initState } from './init';
import {
  saveHighScore,
  saveColorPalette,
  saveSoundOn,
  loadSoundOn,
  saveGridMode,
  saveHapticsOn,
  loadHapticsOn,
  saveReducedMotion,
  saveRun,
  loadRun,
  clearRun,
  resetStats as clearStats,
  EMPTY_STATS,
} from './persistence';
import { runCollapseLoop, nukeCenterAndSettle } from './animations';
import { recordRunEnd, flushStats, bumpStats } from './stats';
import { setSoundEnabled, playPush, playGameOver } from '../sound';
import { setHapticsEnabled, hapticPush, hapticGameOver } from '../haptics';

setSoundEnabled(loadSoundOn());
setHapticsEnabled(loadHapticsOn());

const useGameStore = create<GameStore>((set, get) => ({
  ...initState(),

  // Starting a fresh run abandons any persisted one — otherwise Continue would
  // offer a game the player already chose to leave.
  reset() { clearRun(); set({ ...initState(get().gridMode), hasSavedRun: false }); },
  resetHighScore() { saveHighScore(get().gridMode, 0); set({ highScore: 0 }); },
  setGridMode(mode: GridMode) { saveGridMode(mode); clearRun(); set({ ...initState(mode), hasSavedRun: false }); },
  setColorPalette(id) { saveColorPalette(id); set({ colorPalette: id }); },
  setSoundOn(on) { saveSoundOn(on); setSoundEnabled(on); set({ soundOn: on }); },
  setHapticsOn(on) { saveHapticsOn(on); setHapticsEnabled(on); set({ hapticsOn: on }); },
  setReducedMotion(on) { saveReducedMotion(on); set({ reducedMotion: on }); },

  resetStats() { clearStats(); set({ stats: { ...EMPTY_STATS } }); },


  // Snapshot the run so a reload, a reclaimed tab or a stray navigation doesn't
  // cost the player a 100+ push game. Turn 0 has nothing worth restoring and a
  // finished run must not come back, so both are skipped (and clear the slot).
  persistRun() {
    const s = get();
    if (s.gameOver || s.turnCount === 0) {
      if (s.hasSavedRun) { clearRun(); set({ hasSavedRun: false }); }
      return;
    }
    saveRun({
      gridMode: s.gridMode,
      grid: s.grid,
      leftPending: s.leftPending,
      rightPending: s.rightPending,
      topPending: s.topPending,
      bottomPending: s.bottomPending,
      score: s.score,
      turnCount: s.turnCount,
      nukeCharge: s.nukeCharge,
      nukeArmed: s.nukeArmed,
      lastVerticalSide: s.lastVerticalSide,
      lastHorizontalSide: s.lastHorizontalSide,
    });
    flushStats(get);
    if (!s.hasSavedRun) set({ hasSavedRun: true });
  },

  // Rebuild a persisted run. initState() first so every transient field (flash
  // sets, flying tiles, layout, and a fresh runId that invalidates any chain
  // still pending from the discarded board) starts clean, then the saved values
  // are laid over it.
  resumeRun() {
    const run = loadRun();
    if (!run) { set({ hasSavedRun: false }); return false; }
    const base = initState(run.gridMode);
    // initState reset the ramp to turn 0 — wind it back to where the run was.
    setDifficulty(run.turnCount, run.gridMode);
    set({
      ...base,
      grid: run.grid,
      leftPending: run.leftPending,
      rightPending: run.rightPending,
      topPending: run.topPending,
      bottomPending: run.bottomPending,
      score: run.score,
      turnCount: run.turnCount,
      nukeCharge: run.nukeCharge,
      nukeArmed: run.nukeArmed,
      lastVerticalSide: run.lastVerticalSide,
      lastHorizontalSide: run.lastHorizontalSide,
      hasSavedRun: true,
    });
    return true;
  },

  // Fire the center-cross nuke while the meter is armed. The nuke is full
  // strength at any armed charge level — the draining meter is only the
  // use-it-or-lose-it clock, not a power gauge.
  fireNuke() {
    const s = get();
    if (s.animating || s.gameOver || !s.nukeArmed) return;
    set({
      animating: true,
      nukeCharge: 0,
      nukeArmed: false,
      turnClearedTiles: 0,
      cleanSweepAwarded: false,
    });
    bumpStats(get, set, { nukesFired: 1 });
    nukeCenterAndSettle(s.grid, {}, get, set, s.lastVerticalSide, s.lastHorizontalSide);
  },

  triggerPush(direction: Direction) {
    const s = get();
    if (s.animating || s.gameOver) return;
    // Captured so the deferred commit below can't land in a different game (the
    // player can reset or switch boards during the push animation).
    const runId = s.runId;
    // Advance the difficulty ramp for this push before any new pending is generated.
    const turn = s.turnCount + 1;
    setDifficulty(turn, s.gridMode);
    // Armed nuke meter drains per push; fully drained = nuke lost, recharge from 0.
    const drainedCharge = s.nukeArmed ? s.nukeCharge - NUKE_DECAY_PER_PUSH : s.nukeCharge;
    set({
      combo: 1,
      turnCount: turn,
      nukeCharge: Math.max(0, drainedCharge),
      nukeArmed: s.nukeArmed && drainedCharge > 0,
      turnClearedTiles: 0,
      cleanSweepAwarded: false,
    });
    playPush();
    hapticPush();

    const { cfg, layout } = s;
    let pushFn: (grid: Grid, pending: number[], cfg: GridCfg) => ReturnType<typeof pushFromLeft>;
    let pendingArg: number[];
    let pendingKey: PendingKey;
    let getPendingPos: (i: number) => { x: number; y: number };

    if (direction === 'left') {
      pushFn = pushFromRight; pendingArg = s.rightPending; pendingKey = 'rightPending';
      getPendingPos = (i) => rightPendingPos(i, layout);
    } else if (direction === 'right') {
      pushFn = pushFromLeft; pendingArg = s.leftPending; pendingKey = 'leftPending';
      getPendingPos = (i) => leftPendingPos(i, layout);
    } else if (direction === 'down') {
      pushFn = pushFromTop; pendingArg = s.topPending; pendingKey = 'topPending';
      getPendingPos = (i) => topPendingPos(i, layout);
    } else {
      pushFn = pushFromBottom; pendingArg = s.bottomPending; pendingKey = 'bottomPending';
      getPendingPos = (i) => bottomPendingPos(i, layout);
    }

    const newVerticalSide: VerticalSide =
      pendingKey === 'topPending' ? 'top' : pendingKey === 'bottomPending' ? 'bottom' : s.lastVerticalSide;
    const newHorizontalSide: HorizontalSide =
      pendingKey === 'leftPending' ? 'left' : pendingKey === 'rightPending' ? 'right' : s.lastHorizontalSide;

    const result = pushFn(s.grid, pendingArg, cfg);
    const payload = { grid: result.grid, [pendingKey]: result.pending };
    const pc = { payload, blockedIndices: result.blockedIndices, pendingKey };

    const flying: FlyingTileDescriptor[] = result.landings.map((land, idx) => ({
      id: idx,
      value: pendingArg[land.pendingIdx],
      from: getPendingPos(land.pendingIdx),
      to: cellPos(land.row, land.col, layout),
    }));

    if (flying.length === 0) {
      set({ ...pc.payload, lastVerticalSide: newVerticalSide, lastHorizontalSide: newHorizontalSide });
      if (checkGameOver(pc.payload.grid, cfg)) {
        const newHighScore = Math.max(get().score, get().highScore);
        saveHighScore(get().gridMode, newHighScore);
        set({ gameOver: true, highScore: newHighScore });
        playGameOver();
        hapticGameOver();
        recordRunEnd(get, set);
        clearRun();
        set({ hasSavedRun: false });
      }
      return;
    }

    set({
      pendingCommit: pc,
      flyingTiles: flying,
      flyingSource: pendingKey.replace('Pending', '') as FlyingSource,
      animating: true,
    });

    setTimeout(() => {
      const { pendingCommit: commit, runId: curRunId } = get();
      if (!commit || curRunId !== runId) return;
      const { payload: commitPayload, pendingKey: pKey } = commit;
      set({ flyingTiles: [], flyingSource: null, pendingCommit: null });
      const { grid: payloadGrid } = commitPayload;
      set({ grid: payloadGrid, [pKey]: result.pending, lastVerticalSide: newVerticalSide, lastHorizontalSide: newHorizontalSide });
      runCollapseLoop(payloadGrid, {}, get, set, newVerticalSide, newHorizontalSide);
    }, ANIM_MS + 30);
  },
}));

// A run persisted by an earlier session is what the menu's Continue button
// offers; the freshly-initialised board above is the "new game" it sits beside.
useGameStore.setState({ hasSavedRun: loadRun() !== null });

// Test/debug handle for E2E drivers (the game is fully client-side, so this
// exposes nothing a devtools user couldn't already reach).
if (typeof window !== 'undefined') {
  (window as unknown as { __untiledStore: typeof useGameStore }).__untiledStore = useGameStore;
}

export default useGameStore;
