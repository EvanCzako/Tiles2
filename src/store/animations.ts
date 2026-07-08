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
  getTileColor,
  MAX_COMBO,
  NUKE_CHARGE_MAX,
  CLEAN_SWEEP_BONUS_PER_TILE,
} from '../game';
import { buildFrozenSnapshot, scheduleAutoMoveIfForced } from './init';
import { saveHighScore } from './persistence';
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

// ── Juice helpers ──────────────────────────────────────────────────────────
let popupSeq = 0;
export function spawnScorePopup(
  cells: [number, number][],
  text: string,
  tier: number,
  get: ZustandGet,
  set: ZustandSet
): void {
  if (cells.length === 0) return;
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
  setTimeout(() => set({ scorePopups: get().scorePopups.filter((p) => p.id !== id) }), POPUP_MS);
}

let announceSeq = 0;
function announce(text: string, get: ZustandGet, set: ZustandSet, color?: string): void {
  const id = ++announceSeq;
  set({ announcement: { text, id, color } });
  setTimeout(() => {
    if (get().announcement?.id === id) set({ announcement: null });
  }, ANNOUNCE_MS);
}

let shakeSeq = 0;
function triggerShake(tier: ShakeState['tier'], get: ZustandGet, set: ZustandSet): void {
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
  const curCfg = get().cfg;

  // ── Clean sweep — the entire play area was emptied this turn ─────────────
  // Awarded once per turn, before corner settlement (corners refill themselves
  // and are excluded from the check). Bonus scales with how much was cleared.
  if (!get().cleanSweepAwarded && get().turnClearedTiles > 0 && isPlayAreaEmpty(grid, curCfg)) {
    const mult = Math.min(get().combo, MAX_COMBO);
    const bonus = CLEAN_SWEEP_BONUS_PER_TILE * get().turnClearedTiles * mult;
    playCleanSweep();
    triggerShake('big', get, set);
    announce('CLEAN SWEEP!', get, set, '#ffcc00');
    spawnScorePopup([[curCfg.CENTER_ROW, curCfg.CENTER_COL]], `+${bonus}`, mult, get, set);
    set({
      score: get().score + bonus,
      nukeCharge: NUKE_CHARGE_MAX,
      cleanSweepAwarded: true,
    });
  }

  const { grid: settledGrid, movedGrid, midGrid, verticalMoves, horizontalMoves } = settleCorners(grid, curCfg);

  const finalize = (finalGrid: Grid) => {
    set({
      animating: false,
      combo: 1,
      flyingTiles: [],
      collapsingCells: new Set(),
      grid: finalGrid,
      frozenPendingRows: buildFrozenSnapshot(finalGrid, curCfg),
      ...pendingPayload,
    });
    if (checkGameOver(finalGrid, curCfg)) {
      const newHighScore = Math.max(get().score, get().highScore);
      saveHighScore(get().gridMode, newHighScore);
      set({ gameOver: true, highScore: newHighScore });
      playGameOver();
    } else {
      scheduleAutoMoveIfForced(get);
    }
  };

  // Phase: all slides done — first commit the slide result (empty slots visible),
  // then in the next render frame reveal the newly generated refill tiles.
  const afterCornerSettle = () => {
    set({ flyingTiles: [], collapsingCells: new Set(), grid: movedGrid });
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        set({ grid: settledGrid });
        const { annihilatedCells } = annihilateAdjacent(settledGrid, curCfg);
        if (annihilatedCells.length === 0) { finalize(settledGrid); return; }
        const s = get();
        runCollapseLoop(settledGrid, pendingPayload, get, set, s.lastVerticalSide, s.lastHorizontalSide, 1);
      })
    );
  };

  const runPhase2 = () => {
    if (horizontalMoves.length === 0) { afterCornerSettle(); return; }
    const curLayout = get().layout;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        set({
          flyingTiles: horizontalMoves.map((m, idx) => ({
            id: `corner-h-${idx}`,
            value: m.value,
            from: cellPos(m.fromRow, m.fromCol, curLayout),
            to: cellPos(m.toRow, m.toCol, curLayout),
            flyThrough: false,
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
      set({
        flyingTiles: verticalMoves.map((m, idx) => ({
          id: `corner-v-${idx}`,
          value: m.value,
          from: cellPos(m.fromRow, m.fromCol, curLayout),
          to: cellPos(m.toRow, m.toCol, curLayout),
          flyThrough: false,
        })),
        collapsingCells: new Set(verticalMoves.map((m) => `${m.fromRow},${m.fromCol}`)),
      });
      setTimeout(() => {
        set({ grid: midGrid, flyingTiles: [], collapsingCells: new Set() });
        runPhase2();
      }, ANIM_MS + 30);
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
  const { cfg } = get();
  const { grid: collapsedGrid, midGrid, gravityMoves, horizontalMoves } =
    collapseGrid(grid, cfg, lastVerticalSide, lastHorizontalSide);

  const BOARD_WIPE_STAGGER_MS = 150;

  const afterCollapse = (settled: Grid) => {
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
      set({ grid: annGrid, annihilateSet: new Set(), boardWipeFlashSet: new Set(), bombFlashSet: new Set() });
      runCollapseLoop(annGrid, pendingPayload, get, set, lastVerticalSide, lastHorizontalSide, nextCombo_, chargeNuke);
    };

    const mult = Math.min(combo, MAX_COMBO);
    const gained = annScore * mult;
    const prevCharge = get().nukeCharge;
    const newCharge = chargeNuke ? Math.min(NUKE_CHARGE_MAX, prevCharge + mult) : prevCharge;
    set({
      score: get().score + gained,
      combo: mult,
      nukeCharge: newCharge,
      // unlocked tiles stay on the board, so they don't count as cleared
      turnClearedTiles: get().turnClearedTiles + annihilatedCells.length - unlockedCells.length,
    });

    playMatch(mult);
    if (bombBlastCells.length > 0) {
      playBomb();
      triggerShake('small', get, set);
    }
    if (boardWipeValues.length > 0) {
      playBoardWipe();
      // "ALL 5s!" — tinted with the wiped value's tile color
      const label = boardWipeValues.map((v) => `${v}s`).join(' & ');
      announce(`ALL ${label}!`, get, set, getTileColor(boardWipeValues[0], get().colorPalette).bg);
    }
    if (newCharge === NUKE_CHARGE_MAX && prevCharge < NUKE_CHARGE_MAX) playNukeReady();
    if (gained > 0) spawnScorePopup(annihilatedCells, `+${gained}`, mult, get, set);

    if (boardWipeGroupCells.length > 0) {
      // Phase 1: group cells flash immediately in their tile color
      set({
        boardWipeFlashSet: new Set(boardWipeGroupCells.map(([r, c]) => `${r},${c}`)),
        ...(regularCells.length > 0 && { annihilateSet: new Set(regularCells.map(([r, c]) => `${r},${c}`)) }),
        ...(bombFlash.size > 0 && { bombFlashSet: bombFlash }),
      });
      // Phase 2: spread cells join 150 ms later
      setTimeout(() => {
        if (boardWipeSpreadCells.length > 0) {
          set({
            boardWipeFlashSet: new Set([
              ...boardWipeGroupCells.map(([r, c]) => `${r},${c}`),
              ...boardWipeSpreadCells.map(([r, c]) => `${r},${c}`),
            ]),
          });
        }
        setTimeout(proceed, FLASH_MS);
      }, BOARD_WIPE_STAGGER_MS);
    } else {
      set({
        annihilateSet: new Set(regularCells.map(([r, c]) => `${r},${c}`)),
        ...(bombFlash.size > 0 && { bombFlashSet: bombFlash }),
      });
      setTimeout(proceed, FLASH_MS);
    }
  };

  const doHorizontalPhase = () => {
    if (horizontalMoves.length === 0) { afterCollapse(collapsedGrid); return; }
    const curLayout = get().layout;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        set({
          flyingTiles: horizontalMoves.map((m, idx) => ({
            id: `collapse-h-${idx}`,
            value: m.value,
            from: cellPos(m.fromRow, m.fromCol, curLayout),
            to: cellPos(m.toRow, m.toCol, curLayout),
            flyThrough: false,
          })),
          collapsingCells: new Set(horizontalMoves.map((m) => `${m.fromRow},${m.fromCol}`)),
        });
        setTimeout(() => {
          set({ grid: collapsedGrid, flyingTiles: [], collapsingCells: new Set() });
          afterCollapse(collapsedGrid);
        }, ANIM_MS + 30);
      })
    );
  };

  if (gravityMoves.length === 0 && horizontalMoves.length === 0) {
    afterCollapse(grid);
    return;
  }

  if (gravityMoves.length === 0) { doHorizontalPhase(); return; }

  const curLayout = get().layout;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      set({
        flyingTiles: gravityMoves.map((m, idx) => ({
          id: `collapse-g-${idx}`,
          value: m.value,
          from: cellPos(m.fromRow, m.fromCol, curLayout),
          to: cellPos(m.toRow, m.toCol, curLayout),
          flyThrough: false,
        })),
        collapsingCells: new Set(gravityMoves.map((m) => `${m.fromRow},${m.fromCol}`)),
      });
      setTimeout(() => {
        set({ grid: midGrid, flyingTiles: [], collapsingCells: new Set() });
        doHorizontalPhase();
      }, ANIM_MS + 30);
    })
  );
}

// ── Center-cross nuke, fired manually once the charge meter is full ────────
export function nukeCenterAndSettle(
  grid: Grid,
  pendingPayload: Partial<GameStore>,
  get: ZustandGet,
  set: ZustandSet,
  lastVerticalSide: VerticalSide,
  lastHorizontalSide: HorizontalSide
): void {
  const { cfg } = get();
  const { ROWS, COLS, CENTER_ROW, CENTER_COL } = cfg;

  const flashCells = new Set<string>();
  for (let c = 0; c < COLS; c++) flashCells.add(`${CENTER_ROW},${c}`);
  for (let r = 0; r < ROWS; r++) {
    if (r !== CENTER_ROW) flashCells.add(`${r},${CENTER_COL}`);
  }

  const { cells: clearCells, score: centerScore } = nukeCrossScore(grid, cfg);

  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      playNuke();
      triggerShake('big', get, set);
      announce('NUKE!', get, set);
      set({
        score: get().score + centerScore * MAX_COMBO,
        combo: MAX_COMBO,
        nukeFlashSet: flashCells,
        nukeActive: true,
      });
      if (centerScore > 0) {
        spawnScorePopup(clearCells, `+${centerScore * MAX_COMBO}`, MAX_COMBO, get, set);
      }
      setTimeout(() => {
        const nukedGrid = grid.map((row) => [...row]);
        for (const [r, c] of clearCells) nukedGrid[r][c] = 0;
        set({
          grid: nukedGrid,
          nukeFlashSet: new Set(),
          turnClearedTiles: get().turnClearedTiles + clearCells.length,
        });
        runCollapseLoop(nukedGrid, pendingPayload, get, set, lastVerticalSide, lastHorizontalSide, MAX_COMBO, false);
      }, FLASH_MS);
      setTimeout(() => set({ nukeActive: false }), 600);
    })
  );
}
