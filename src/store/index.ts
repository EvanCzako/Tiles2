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
import { CELL, GAP, ANIM_MS } from '../constants';
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
  createInitialPending,
  NUKE_DECAY_PER_PUSH,
  REROLL_COOLDOWN,
} from '../game';
import { initState, scheduleAutoMoveIfForced } from './init';
import { saveHighScore, saveColorPalette, saveSoundOn, loadSoundOn } from './persistence';
import { runCollapseLoop, nukeCenterAndSettle } from './animations';
import { setSoundEnabled, playPush, playGameOver, playReroll } from '../sound';

setSoundEnabled(loadSoundOn());

const useGameStore = create<GameStore>((set, get) => ({
  ...initState(),

  reset() { set(initState(get().gridMode)); },
  resetHighScore() { saveHighScore(get().gridMode, 0); set({ highScore: 0 }); },
  setGridMode(mode: GridMode) { set(initState(mode)); },
  setColorPalette(id) { saveColorPalette(id); set({ colorPalette: id }); },
  setSoundOn(on) { saveSoundOn(on); setSoundEnabled(on); set({ soundOn: on }); },

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
      rerollArmed: false,
      turnClearedTiles: 0,
      cleanSweepAwarded: false,
    });
    nukeCenterAndSettle(s.grid, {}, get, set, s.lastVerticalSide, s.lastHorizontalSide);
  },

  // Arm/disarm strip-pick mode for the reroll ability.
  toggleRerollArm() {
    const s = get();
    if (s.gameOver || s.turnsUntilReroll > 0) return;
    set({ rerollArmed: !s.rerollArmed });
  },

  // Reroll one pending strip (chosen by tapping it while armed).
  rerollStrip(side) {
    const s = get();
    if (!s.rerollArmed || s.turnsUntilReroll > 0 || s.animating || s.gameOver) return;
    playReroll();
    set({
      [`${side}Pending`]: createInitialPending(s.cfg),
      rerollArmed: false,
      turnsUntilReroll: REROLL_COOLDOWN,
    });
    // Spending the reroll may leave the player truly forced — resume auto-move.
    scheduleAutoMoveIfForced(get);
  },

  triggerPush(direction: Direction) {
    const s = get();
    if (s.animating || s.gameOver) return;
    // Armed nuke meter drains per push; fully drained = nuke lost, recharge from 0.
    const drainedCharge = s.nukeArmed ? s.nukeCharge - NUKE_DECAY_PER_PUSH : s.nukeCharge;
    set({
      combo: 1,
      nukeCharge: Math.max(0, drainedCharge),
      nukeArmed: s.nukeArmed && drainedCharge > 0,
      rerollArmed: false,
      turnsUntilReroll: Math.max(0, s.turnsUntilReroll - 1),
      turnClearedTiles: 0,
      cleanSweepAwarded: false,
    });
    playPush();

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

    const rowIsVisible = (idx: number): boolean => {
      if (pendingKey === 'topPending' || pendingKey === 'bottomPending')
        return s.grid.some((row) => row[cfg.PENDING_COL_START + idx] !== 0);
      return s.grid[cfg.PENDING_ROW_START + idx].some((v) => v !== 0);
    };

    const flying: FlyingTileDescriptor[] = result.landings
      .filter((land) => !land.flyThrough || rowIsVisible(land.pendingIdx))
      .map((land, idx) => {
        const from = getPendingPos(land.pendingIdx);
        let to: { x: number; y: number };
        let flyThrough: boolean;
        if (land.flyThrough) {
          flyThrough = true;
          if (pendingKey === 'leftPending')
            to = { x: layout.sideOffset + layout.gridPx + GAP * 4 + CELL, y: from.y };
          else if (pendingKey === 'rightPending') to = { x: -CELL * 2, y: from.y };
          else if (pendingKey === 'topPending') to = { x: from.x, y: layout.CONTAINER_H + CELL };
          else to = { x: from.x, y: -CELL };
        } else {
          flyThrough = false;
          to = cellPos(land.row!, land.col!, layout);
        }
        return { id: idx, value: pendingArg[land.pendingIdx], from, to, flyThrough };
      });

    if (flying.length === 0) {
      set({ ...pc.payload, lastVerticalSide: newVerticalSide, lastHorizontalSide: newHorizontalSide });
      if (checkGameOver(pc.payload.grid, cfg)) {
        const newHighScore = Math.max(get().score, get().highScore);
        saveHighScore(get().gridMode, newHighScore);
        set({ gameOver: true, highScore: newHighScore });
        playGameOver();
      } else {
        scheduleAutoMoveIfForced(get);
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
      const { pendingCommit: commit } = get();
      if (!commit) return;
      const { payload: commitPayload, pendingKey: pKey } = commit;
      set({ flyingTiles: [], flyingSource: null, pendingCommit: null });
      const { grid: payloadGrid } = commitPayload;
      set({ grid: payloadGrid, [pKey]: result.pending, lastVerticalSide: newVerticalSide, lastHorizontalSide: newHorizontalSide });
      runCollapseLoop(payloadGrid, {}, get, set, newVerticalSide, newHorizontalSide);
    }, ANIM_MS + 30);
  },
}));

// Test/debug handle for E2E drivers (the game is fully client-side, so this
// exposes nothing a devtools user couldn't already reach).
if (typeof window !== 'undefined') {
  (window as unknown as { __untiledStore: typeof useGameStore }).__untiledStore = useGameStore;
}

export default useGameStore;
