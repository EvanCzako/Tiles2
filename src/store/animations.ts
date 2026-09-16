import type { Grid, GameStore, VerticalSide, HorizontalSide, ShakeState } from '../types';
import { cellPos } from '../layout';
import { ANIM_MS, FLASH_MS, CELL, POPUP_MS, SHAKE_MS, ANNOUNCE_MS } from '../constants';
import {
  settleCorners,
  annihilateAdjacent,
  collapseGrid,
  checkGameOver,
  isPlayAreaEmpty,
  nextCombo,
  nukeCrossScore,
  nukePlusCells,
  getTileColor,
  MAX_COMBO,
  NUKE_CHARGE_MAX,
  CLEAN_SWEEP_BONUS_PER_TILE,
} from '../game';
import { saveHighScore, clearRun } from './persistence';
import { recordRunEnd, bumpStats, raiseStat } from './stats';
import {
  hapticMatch,
  hapticBoardWipe,
  hapticNuke,
  hapticCleanSweep,
  hapticGameOver,
} from '../haptics';
import {
  playMatch,
  playBoardWipe,
  playBomb,
  playNuke,
  playNukeReady,
  playCleanSweep,
  playGameOver,
} from '../sound';

type ZustandSet = (partial: Partial<GameStore>) => void;
type ZustandGet = () => GameStore;

// ── Run guard ──────────────────────────────────────────────────────────────
// A cascade is a chain of setTimeout/requestAnimationFrame callbacks that can
// easily outlive the game that started it: the header title navigates to the
// menu at any time, and reset() / setGridMode() then install a whole new state
// while those timers are still pending. Without a guard the abandoned chain
// keeps calling set(), writing its old grid — and on a board switch, its old
// *dimensions* — into the fresh game, which crashes the next push.
//
// Each chain captures the runId it started under; once initState() bumps that
// id every write is dropped and the chain unwinds on its next callback.
function runGuard(get: ZustandGet, set: ZustandSet): { alive: () => boolean; commit: ZustandSet } {
  const runId = get().runId;
  const alive = () => get().runId === runId;
  return {
    alive,
    commit: (partial: Partial<GameStore>) => {
      if (alive()) set(partial);
    },
  };
}

// ── Fast-forward ───────────────────────────────────────────────────────────
// When the player leaves the game screen mid-cascade the chain must not keep
// animating, sounding and buzzing behind the menu. Rather than writing a second,
// synchronous settle path (which would duplicate every cascade rule and drift
// from this one), the SAME chain is re-run with its delays collapsed to zero and
// its juice suppressed: the board reaches exactly the state it would have, the
// score and stats count in full, and it all happens within a frame or two.
//
// Timers already scheduled keep their original delay, so one in-flight step may
// still land before the flag takes effect — after that everything is silent.
let instant = false;

export function setInstantSettle(on: boolean): void {
  instant = on;
}

const delay = (ms: number): number => (instant ? 0 : ms);
/** Run a juice effect unless we're fast-forwarding a cascade nobody is watching. */
const juice = (fn: () => void): void => {
  if (!instant) fn();
};

// ── Juice helpers ──────────────────────────────────────────────────────────
let popupSeq = 0;
export function spawnScorePopup(
  cells: [number, number][],
  text: string,
  tier: number,
  get: ZustandGet,
  set: ZustandSet
): void {
  if (instant || cells.length === 0) return;
  const layout = get().layout;
  let sx = 0, sy = 0;
  for (const [r, c] of cells) {
    const p = cellPos(r, c, layout);
    sx += p.x;
    sy += p.y;
  }
  const x = sx / cells.length + CELL / 2;
  const y = sy / cells.length + CELL / 2;
  const id = ++popupSeq;
  set({ scorePopups: [...get().scorePopups, { id, x, y, text, tier }] });
  setTimeout(() => {
    const popups = get().scorePopups;
    // Gone already (a reset cleared the list) — nothing to remove.
    if (popups.some((p) => p.id === id)) set({ scorePopups: popups.filter((p) => p.id !== id) });
  }, POPUP_MS);
}

let announceSeq = 0;
function announce(text: string, get: ZustandGet, set: ZustandSet, color?: string): void {
  if (instant) return;
  const id = ++announceSeq;
  set({ announcement: { text, id, color } });
  setTimeout(() => {
    if (get().announcement?.id === id) set({ announcement: null });
  }, ANNOUNCE_MS);
}

let shakeSeq = 0;
function triggerShake(tier: ShakeState['tier'], get: ZustandGet, set: ZustandSet): void {
  // Screen shake is the one effect here that is a genuine vestibular trigger,
  // so reduced motion drops it at the source rather than just muting the CSS —
  // that also skips the state churn and the cleanup timer.
  if (instant || get().reducedMotion) return;
  const id = ++shakeSeq;
  set({ shake: { tier, id } });
  setTimeout(() => {
    if (get().shake?.id === id) set({ shake: null });
  }, SHAKE_MS);
}

// ── End-of-turn helper ─────────────────────────────────────────────────────
// Two-phase corner settlement: vertical gravity first, then horizontal.
// Phases are animated sequentially (no diagonal moves). New tiles appear after
// both phases; if the refill creates matches, re-enters the cascade.
export function endTurn(
  grid: Grid,
  pendingPayload: Partial<GameStore>,
  get: ZustandGet,
  set: ZustandSet
): void {
  const { alive, commit } = runGuard(get, set);
  const curCfg = get().cfg;

  // ── Clean sweep — the entire play area was emptied this turn ─────────────
  // Awarded once per turn, before corner settlement (corners refill themselves
  // and are excluded from the check). Bonus scales with how much was cleared.
  // Pays a score bonus only — it does not refill the nuke meter (a free nuke on
  // top of the score bonus made runs snowball).
  if (!get().cleanSweepAwarded && get().turnClearedTiles > 0 && isPlayAreaEmpty(grid, curCfg)) {
    const mult = Math.min(get().combo, MAX_COMBO);
    const bonus = CLEAN_SWEEP_BONUS_PER_TILE * get().turnClearedTiles * mult;
    juice(() => { playCleanSweep(); hapticCleanSweep(); });
    bumpStats(get, set, { cleanSweeps: 1 });
    triggerShake('big', get, set);
    announce('CLEAN SWEEP!', get, set, '#ffcc00');
    spawnScorePopup([[curCfg.CENTER_ROW, curCfg.CENTER_COL]], `+${bonus}`, mult, get, set);
    commit({
      score: get().score + bonus,
      cleanSweepAwarded: true,
    });
  }

  const { grid: settledGrid, movedGrid, midGrid, verticalMoves, horizontalMoves } = settleCorners(grid, curCfg);

  const finalize = (finalGrid: Grid) => {
    if (!alive()) return;
    commit({
      animating: false,
      combo: 1,
      flyingTiles: [],
      collapsingCells: new Set(),
      grid: finalGrid,
      ...pendingPayload,
    });
    if (checkGameOver(finalGrid, curCfg)) {
      const newHighScore = Math.max(get().score, get().highScore);
      saveHighScore(get().gridMode, newHighScore);
      commit({ gameOver: true, highScore: newHighScore });
      juice(() => { playGameOver(); hapticGameOver(); });
      if (alive()) {
        recordRunEnd(get, set);
        clearRun();
        commit({ hasSavedRun: false });
      }
      return;
    }
    // End of turn is the one quiescent point in the cascade — nothing is
    // animating and the grid is final — so it is where the run is snapshotted.
    if (alive()) get().persistRun();
  };

  // Phase: all slides done — first commit the slide result (empty slots visible),
  // then in the next render frame reveal the newly generated refill tiles.
  const afterCornerSettle = () => {
    if (!alive()) return;
    commit({ flyingTiles: [], collapsingCells: new Set(), grid: movedGrid });
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!alive()) return;
        commit({ grid: settledGrid });
        const { annihilatedCells } = annihilateAdjacent(settledGrid, curCfg);
        if (annihilatedCells.length === 0) { finalize(settledGrid); return; }
        const s = get();
        runCollapseLoop(settledGrid, pendingPayload, get, set, s.lastVerticalSide, s.lastHorizontalSide, 1);
      })
    );
  };

  const runPhase2 = () => {
    if (!alive()) return;
    if (horizontalMoves.length === 0) { afterCornerSettle(); return; }
    const curLayout = get().layout;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!alive()) return;
        commit({
          flyingTiles: horizontalMoves.map((m, idx) => ({
            id: `corner-h-${idx}`,
            value: m.value,
            from: cellPos(m.fromRow, m.fromCol, curLayout),
            to: cellPos(m.toRow, m.toCol, curLayout),
          })),
          collapsingCells: new Set(horizontalMoves.map((m) => `${m.fromRow},${m.fromCol}`)),
        });
        setTimeout(() => afterCornerSettle(), ANIM_MS + 30);
      })
    );
  };

  if (verticalMoves.length === 0) { runPhase2(); return; }
  const curLayout = get().layout;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (!alive()) return;
      commit({
        flyingTiles: verticalMoves.map((m, idx) => ({
          id: `corner-v-${idx}`,
          value: m.value,
          from: cellPos(m.fromRow, m.fromCol, curLayout),
          to: cellPos(m.toRow, m.toCol, curLayout),
        })),
        collapsingCells: new Set(verticalMoves.map((m) => `${m.fromRow},${m.fromCol}`)),
      });
      setTimeout(() => {
        if (!alive()) return;
        commit({ grid: midGrid, flyingTiles: [], collapsingCells: new Set() });
        runPhase2();
      }, delay(ANIM_MS + 30));
    })
  );
}

// ── Collapse + annihilate loop ─────────────────────────────────────────────
// chargeNuke=false during nuke-initiated cascades so a fired nuke can't
// immediately re-charge itself off its own fallout.
export function runCollapseLoop(
  grid: Grid,
  pendingPayload: Partial<GameStore>,
  get: ZustandGet,
  set: ZustandSet,
  lastVerticalSide: VerticalSide = 'top',
  lastHorizontalSide: HorizontalSide = 'left',
  combo: number = 1,
  chargeNuke: boolean = true
): void {
  const { alive, commit } = runGuard(get, set);
  const { cfg } = get();
  const { grid: collapsedGrid, midGrid, gravityMoves, stages } =
    collapseGrid(grid, cfg, lastVerticalSide, lastHorizontalSide);

  const BOARD_WIPE_STAGGER_MS = 150;

  const afterCollapse = (settled: Grid) => {
    if (!alive()) return;
    const curCfg = get().cfg;
    const {
      annihilatedCells, grid: annGrid, score: annScore,
      boardWipeValues, boardWipeGroupCells, boardWipeSpreadCells, regularCells, bombBlastCells, unlockedCells,
    } = annihilateAdjacent(settled, curCfg);
    const bombFlash = new Set(bombBlastCells.map(([r, c]) => `${r},${c}`));

    if (annihilatedCells.length === 0) {
      endTurn(settled, pendingPayload, get, set);
      return;
    }

    const nextCombo_ = nextCombo(combo);
    const proceed = () => {
      if (!alive()) return;
      commit({ grid: annGrid, annihilateSet: new Set(), boardWipeFlashSet: new Set(), bombFlashSet: new Set() });
      runCollapseLoop(annGrid, pendingPayload, get, set, lastVerticalSide, lastHorizontalSide, nextCombo_, chargeNuke);
    };

    const mult = Math.min(combo, MAX_COMBO);
    const gained = annScore * mult;
    // No accrual while armed — the meter is a use-it-or-lose-it countdown then.
    const wasArmed = get().nukeArmed;
    const prevCharge = get().nukeCharge;
    const newCharge =
      chargeNuke && !wasArmed ? Math.min(NUKE_CHARGE_MAX, prevCharge + mult) : prevCharge;
    const nowArmed = wasArmed || newCharge >= NUKE_CHARGE_MAX;
    commit({
      score: get().score + gained,
      combo: mult,
      nukeCharge: newCharge,
      nukeArmed: nowArmed,
      // unlocked tiles stay on the board, so they don't count as cleared
      turnClearedTiles: get().turnClearedTiles + annihilatedCells.length - unlockedCells.length,
    });

    juice(() => { playMatch(mult); hapticMatch(mult); });
    bumpStats(get, set, { tilesCleared: annihilatedCells.length - unlockedCells.length });
    raiseStat(get, set, 'bestCombo', mult);
    if (bombBlastCells.length > 0) {
      juice(playBomb);
      triggerShake('small', get, set);
    }
    if (boardWipeValues.length > 0) {
      juice(() => { playBoardWipe(); hapticBoardWipe(); });
      bumpStats(get, set, { boardWipes: boardWipeValues.length });
      // "ALL 5s!" — tinted with the wiped value's tile color
      const label = boardWipeValues.map((v) => `${v}s`).join(' & ');
      announce(`ALL ${label}!`, get, set, getTileColor(boardWipeValues[0], get().colorPalette).bg);
    }
    if (nowArmed && !wasArmed) juice(playNukeReady);
    if (gained > 0) spawnScorePopup(annihilatedCells, `+${gained}`, mult, get, set);

    if (boardWipeGroupCells.length > 0) {
      // Phase 1: group cells flash immediately in their tile color
      commit({
        boardWipeFlashSet: new Set(boardWipeGroupCells.map(([r, c]) => `${r},${c}`)),
        ...(regularCells.length > 0 && { annihilateSet: new Set(regularCells.map(([r, c]) => `${r},${c}`)) }),
        ...(bombFlash.size > 0 && { bombFlashSet: bombFlash }),
      });
      // Phase 2: spread cells join 150 ms later
      setTimeout(() => {
        if (!alive()) return;
        if (boardWipeSpreadCells.length > 0) {
          commit({
            boardWipeFlashSet: new Set([
              ...boardWipeGroupCells.map(([r, c]) => `${r},${c}`),
              ...boardWipeSpreadCells.map(([r, c]) => `${r},${c}`),
            ]),
          });
        }
        setTimeout(proceed, delay(FLASH_MS));
      }, delay(BOARD_WIPE_STAGGER_MS));
    } else {
      commit({
        annihilateSet: new Set(regularCells.map(([r, c]) => `${r},${c}`)),
        ...(bombFlash.size > 0 && { bombFlashSet: bombFlash }),
      });
      setTimeout(proceed, delay(FLASH_MS));
    }
  };

  // Play the post-gravity passes in order. Each stage is single-axis (horizontal or vertical) and
  // commits its own grid snapshot before the next runs, so a tile that turns a corner around an
  // obstacle animates as separate straight segments — never a diagonal slide.
  const runStages = (i: number) => {
    if (!alive()) return;
    if (i >= stages.length) { afterCollapse(collapsedGrid); return; }
    const stage = stages[i];
    const curLayout = get().layout;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!alive()) return;
        commit({
          flyingTiles: stage.moves.map((m, idx) => ({
            id: `collapse-s${i}-${idx}`,
            value: m.value,
            from: cellPos(m.fromRow, m.fromCol, curLayout),
            to: cellPos(m.toRow, m.toCol, curLayout),
          })),
          collapsingCells: new Set(stage.moves.map((m) => `${m.fromRow},${m.fromCol}`)),
        });
        setTimeout(() => {
          if (!alive()) return;
          commit({ grid: stage.grid, flyingTiles: [], collapsingCells: new Set() });
          runStages(i + 1);
        }, delay(ANIM_MS + 30));
      })
    );
  };

  if (gravityMoves.length === 0 && stages.length === 0) {
    afterCollapse(grid);
    return;
  }

  if (gravityMoves.length === 0) { runStages(0); return; }

  const curLayout = get().layout;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (!alive()) return;
      commit({
        flyingTiles: gravityMoves.map((m, idx) => ({
          id: `collapse-g-${idx}`,
          value: m.value,
          from: cellPos(m.fromRow, m.fromCol, curLayout),
          to: cellPos(m.toRow, m.toCol, curLayout),
        })),
        collapsingCells: new Set(gravityMoves.map((m) => `${m.fromRow},${m.fromCol}`)),
      });
      setTimeout(() => {
        if (!alive()) return;
        commit({ grid: midGrid, flyingTiles: [], collapsingCells: new Set() });
        runStages(0);
      }, delay(ANIM_MS + 30));
    })
  );
}

// ── Center-plus nuke (5×5 plus at board center), fired manually while armed ─
export function nukeCenterAndSettle(
  grid: Grid,
  pendingPayload: Partial<GameStore>,
  get: ZustandGet,
  set: ZustandSet,
  lastVerticalSide: VerticalSide,
  lastHorizontalSide: HorizontalSide
): void {
  const { alive, commit } = runGuard(get, set);
  const { cfg } = get();

  // Flash the full plus shape (empty cells included); clear/score only the occupied ones.
  const flashCells = new Set<string>(nukePlusCells(cfg).map(([r, c]) => `${r},${c}`));

  const { cells: clearCells, score: centerScore } = nukeCrossScore(grid, cfg);

  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (!alive()) return;
      playNuke();
      hapticNuke();
      triggerShake('big', get, set);
      announce('NUKE!', get, set);
      commit({
        score: get().score + centerScore * MAX_COMBO,
        combo: MAX_COMBO,
        nukeFlashSet: flashCells,
      });
      if (centerScore > 0) {
        spawnScorePopup(clearCells, `+${centerScore * MAX_COMBO}`, MAX_COMBO, get, set);
      }
      setTimeout(() => {
        if (!alive()) return;
        const nukedGrid = grid.map((row) => [...row]);
        for (const [r, c] of clearCells) nukedGrid[r][c] = 0;
        commit({
          grid: nukedGrid,
          nukeFlashSet: new Set(),
          turnClearedTiles: get().turnClearedTiles + clearCells.length,
        });
        runCollapseLoop(nukedGrid, pendingPayload, get, set, lastVerticalSide, lastHorizontalSide, MAX_COMBO, false);
      }, FLASH_MS);
    })
  );
}
