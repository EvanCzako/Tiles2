import type { Grid, GameStore, VerticalSide, HorizontalSide } from '../types';
import { cellPos } from '../layout';
import { ANIM_MS, FLASH_MS, AUTO_MOVE_MS } from '../constants';
import {
  settleCorners,
  annihilateAdjacent,
  collapseGrid,
  checkGameOver,
  nextCombo,
  nukeCrossScore,
  MAX_COMBO,
  NUKE_COMBO,
} from '../game';
import { buildFrozenSnapshot, getAvailableDirections } from './init';
import { saveHighScore } from './persistence';

type ZustandSet = (partial: Partial<GameStore>) => void;
type ZustandGet = () => GameStore;

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
    } else {
      const available = getAvailableDirections(get());
      if (available.length === 1) {
        setTimeout(() => {
          if (!get().gameOver && !get().animating) get().triggerPush(available[0]);
        }, AUTO_MOVE_MS);
      }
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
        runCollapseLoop(settledGrid, pendingPayload, get, set, s.lastVerticalSide, s.lastHorizontalSide, 1, false);
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
export function runCollapseLoop(
  grid: Grid,
  pendingPayload: Partial<GameStore>,
  get: ZustandGet,
  set: ZustandSet,
  lastVerticalSide: VerticalSide = 'top',
  lastHorizontalSide: HorizontalSide = 'left',
  combo: number = 1,
  nukeUsed: boolean = false
): void {
  const { cfg } = get();
  const { grid: collapsedGrid, midGrid, gravityMoves, horizontalMoves } =
    collapseGrid(grid, cfg, lastVerticalSide, lastHorizontalSide);

  const BOARD_WIPE_STAGGER_MS = 150;

  const afterCollapse = (settled: Grid) => {
    const curCfg = get().cfg;
    const {
      annihilatedCells, grid: annGrid, score: annScore,
      boardWipeGroupCells, boardWipeSpreadCells, regularCells, bombBlastCells,
    } = annihilateAdjacent(settled, curCfg);
    const bombFlash = new Set(bombBlastCells.map(([r, c]) => `${r},${c}`));

    if (annihilatedCells.length === 0) {
      endTurn(settled, pendingPayload, get, set);
      return;
    }

    const nextCombo_ = nextCombo(combo);
    const proceed = () => {
      set({ grid: annGrid, annihilateSet: new Set(), boardWipeFlashSet: new Set(), bombFlashSet: new Set() });
      if (nextCombo_ === NUKE_COMBO && !nukeUsed) {
        nukeCenterAndSettle(annGrid, pendingPayload, get, set, lastVerticalSide, lastHorizontalSide);
      } else {
        runCollapseLoop(annGrid, pendingPayload, get, set, lastVerticalSide, lastHorizontalSide, nextCombo_, nukeUsed);
      }
    };

    set({
      score: get().score + annScore * Math.min(combo, MAX_COMBO),
      combo: Math.min(combo, MAX_COMBO),
    });

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

// ── Center nuke triggered on reaching NUKE_COMBO ──────────────────────────
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
      set({
        score: get().score + centerScore * MAX_COMBO,
        combo: MAX_COMBO,
        nukeFlashSet: flashCells,
        nukeActive: true,
      });
      setTimeout(() => {
        const nukedGrid = grid.map((row) => [...row]);
        for (const [r, c] of clearCells) nukedGrid[r][c] = 0;
        set({ grid: nukedGrid, nukeFlashSet: new Set() });
        runCollapseLoop(nukedGrid, pendingPayload, get, set, lastVerticalSide, lastHorizontalSide, MAX_COMBO, true);
      }, FLASH_MS);
      setTimeout(() => set({ nukeActive: false }), 600);
    })
  );
}
