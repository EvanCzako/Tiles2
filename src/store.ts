import { create } from 'zustand';
import {
  GRID_CONFIGS,
  createInitialGrid,
  createInitialPending,
  pushFromLeft,
  pushFromRight,
  pushFromTop,
  pushFromBottom,
  collapseGrid,
  annihilateAdjacent,
  checkGameOver,
  nextCombo,
  MAX_COMBO,
  NUKE_COMBO,
  nukeCrossScore,
  settleCorners,
} from './gameLogic';
import { CELL, GAP, ANIM_MS, FLASH_MS, AUTO_MOVE_MS } from './constants';
import {
  getLayout,
  cellPos,
  leftPendingPos,
  rightPendingPos,
  topPendingPos,
  bottomPendingPos,
} from './layout';
import type {
  Grid,
  GridCfg,
  Layout,
  GridMode,
  Direction,
  VerticalSide,
  HorizontalSide,
  FlyingSource,
  PendingKey,
  FlyingTileDescriptor,
  FrozenPendingRows,
  PendingCommit,
  PendingCommitPayload,
  GameStore,
} from './types';

function getAvailableDirections(s: { grid: Grid; cfg: GridCfg }): Direction[] {
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

const LS_KEY = 'tilesHighScores';

function loadHighScores(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const saved = localStorage.getItem(LS_KEY);
    return saved ? (JSON.parse(saved) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function loadHighScore(mode: string): number {
  return loadHighScores()[mode] ?? 0;
}

function saveHighScore(mode: string, score: number): void {
  if (typeof window === 'undefined') return;
  const scores = loadHighScores();
  scores[mode] = score;
  localStorage.setItem(LS_KEY, JSON.stringify(scores));
}

interface InitState {
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
  collapsingCells: Set<string>;
  pendingCommit: PendingCommit | null;
  frozenPendingRows: FrozenPendingRows | null;
  lastVerticalSide: VerticalSide;
  lastHorizontalSide: HorizontalSide;
}

function initState(mode: GridMode = '9x9'): InitState {
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
    collapsingCells: new Set(),
    pendingCommit: null,
    frozenPendingRows: null,
    lastVerticalSide: 'top',
    lastHorizontalSide: 'left',
  };
}

function buildFrozenSnapshot(grid: Grid, cfg: GridCfg): FrozenPendingRows {
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

// ── End-of-turn helper ─────────────────────────────────────────────────────
// Two-phase corner settlement mirrors main-grid collapse: vertical gravity first,
// then horizontal. Phases are animated sequentially so tiles only ever move in one
// axis at a time (no diagonals). New tiles appear after both phases complete.
function endTurn(
  grid: Grid,
  pendingPayload: Partial<InitState>,
  get: () => GameStore,
  set: (partial: Partial<GameStore>) => void
): void {
  const curCfg = get().cfg;
  const { grid: settledGrid, midGrid, verticalMoves, horizontalMoves } = settleCorners(grid, curCfg);

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
      const currentScore = get().score;
      const currentHighScore = get().highScore;
      const newHighScore = Math.max(currentScore, currentHighScore);
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

  // After both corner phases complete, check whether the new tile placements
  // created any matches. If so, re-enter the cascade; otherwise finalise.
  const afterCornerSettle = (finalGrid: Grid) => {
    const { annihilatedCells } = annihilateAdjacent(finalGrid, curCfg);
    if (annihilatedCells.length === 0) { finalize(finalGrid); return; }
    set({ grid: finalGrid });
    const s = get();
    runCollapseLoop(finalGrid, pendingPayload, get, set, s.lastVerticalSide, s.lastHorizontalSide, 1, false);
  };

  // Phase 2: horizontal slides, then check for new matches.
  const runPhase2 = () => {
    if (horizontalMoves.length === 0) { afterCornerSettle(settledGrid); return; }
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
        setTimeout(() => afterCornerSettle(settledGrid), ANIM_MS + 30);
      })
    );
  };

  // Phase 1: vertical slides, then hand off to phase 2.
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
function runCollapseLoop(
  grid: Grid,
  pendingPayload: Partial<InitState>,
  get: () => GameStore,
  set: (partial: Partial<GameStore>) => void,
  lastVerticalSide: VerticalSide = 'top',
  lastHorizontalSide: HorizontalSide = 'left',
  combo: number = 1,
  nukeUsed: boolean = false
): void {
  const { cfg } = get();
  const {
    grid: collapsedGrid,
    midGrid,
    gravityMoves,
    horizontalMoves,
  } = collapseGrid(grid, cfg, lastVerticalSide, lastHorizontalSide);

  const afterCollapse = (settled: Grid) => {
    const curCfg = get().cfg;
    const {
      annihilatedCells,
      grid: annGrid,
      score: annScore,
    } = annihilateAdjacent(settled, curCfg);

    if (annihilatedCells.length === 0) {
      endTurn(settled, pendingPayload, get, set);
      return;
    }

    const nextCombo_ = nextCombo(combo);
    set({
      score: get().score + annScore * Math.min(combo, MAX_COMBO),
      combo: Math.min(combo, MAX_COMBO),
      annihilateSet: new Set(annihilatedCells.map(([r, c]) => `${r},${c}`)),
    });
    setTimeout(() => {
      set({ grid: annGrid, annihilateSet: new Set() });
      if (nextCombo_ === NUKE_COMBO && !nukeUsed) {
        nukeCenterAndSettle(
          annGrid,
          pendingPayload,
          get,
          set,
          lastVerticalSide,
          lastHorizontalSide
        );
      } else {
        runCollapseLoop(
          annGrid,
          pendingPayload,
          get,
          set,
          lastVerticalSide,
          lastHorizontalSide,
          nextCombo_,
          nukeUsed
        );
      }
    }, FLASH_MS);
  };

  // Animate horizontal phase (inward pack) after gravity has settled
  const doHorizontalPhase = () => {
    if (horizontalMoves.length === 0) {
      afterCollapse(collapsedGrid);
      return;
    }
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

  // Skip gravity animation if there are no gravity moves
  if (gravityMoves.length === 0) {
    doHorizontalPhase();
    return;
  }

  // Animate gravity (downward) first, then horizontal
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

// ── Center nuke triggered on reaching 5x multiplier ────────────────────────
function nukeCenterAndSettle(
  grid: Grid,
  pendingPayload: Partial<InitState>,
  get: () => GameStore,
  set: (partial: Partial<GameStore>) => void,
  lastVerticalSide: VerticalSide,
  lastHorizontalSide: HorizontalSide
): void {
  const { cfg } = get();
  const { ROWS, COLS, CENTER_ROW, CENTER_COL } = cfg;

  // All cross cells flash; nukeCrossScore gives the non-empty subset for score/clear
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
        annihilateSet: flashCells,
      });

      setTimeout(() => {
        const nukedGrid = grid.map((row) => [...row]);
        for (const [r, c] of clearCells) nukedGrid[r][c] = 0;
        set({ grid: nukedGrid, annihilateSet: new Set() });
        runCollapseLoop(
          nukedGrid,
          pendingPayload,
          get,
          set,
          lastVerticalSide,
          lastHorizontalSide,
          MAX_COMBO,
          true
        );
      }, FLASH_MS);
    })
  );
}

// ── Store ───────────────────────────────────────────────────────────────────
const useGameStore = create<GameStore>((set, get) => ({
  ...initState(),

  reset() {
    set(initState(get().gridMode));
  },

  resetHighScore() {
    saveHighScore(get().gridMode, 0);
    set({ highScore: 0 });
  },

  setGridMode(mode: GridMode) {
    set(initState(mode));
  },

  triggerPush(direction: Direction) {
    const s = get();
    if (s.animating || s.gameOver) return;
    set({ combo: 1 });

    const { cfg, layout } = s;
    let pushFn: (grid: Grid, pending: number[], cfg: GridCfg) => ReturnType<typeof pushFromLeft>;
    let pendingArg: number[];
    let pendingKey: PendingKey;
    let getPendingPos: (i: number) => { x: number; y: number };

    if (direction === 'left') {
      pushFn = pushFromRight;
      pendingArg = s.rightPending;
      pendingKey = 'rightPending';
      getPendingPos = (i) => rightPendingPos(i, layout);
    } else if (direction === 'right') {
      pushFn = pushFromLeft;
      pendingArg = s.leftPending;
      pendingKey = 'leftPending';
      getPendingPos = (i) => leftPendingPos(i, layout);
    } else if (direction === 'down') {
      pushFn = pushFromTop;
      pendingArg = s.topPending;
      pendingKey = 'topPending';
      getPendingPos = (i) => topPendingPos(i, layout);
    } else {
      pushFn = pushFromBottom;
      pendingArg = s.bottomPending;
      pendingKey = 'bottomPending';
      getPendingPos = (i) => bottomPendingPos(i, layout);
    }

    // Track each axis independently so left/right pushes don't bias the vertical
    // center, and top/bottom pushes don't bias the horizontal center.
    const newVerticalSide: VerticalSide =
      pendingKey === 'topPending'
        ? 'top'
        : pendingKey === 'bottomPending'
          ? 'bottom'
          : s.lastVerticalSide;
    const newHorizontalSide: HorizontalSide =
      pendingKey === 'leftPending'
        ? 'left'
        : pendingKey === 'rightPending'
          ? 'right'
          : s.lastHorizontalSide;

    const result = pushFn(s.grid, pendingArg, cfg);
    const { landings, blockedIndices } = result;

    // Snapshot row activity BEFORE the push so pending columns stay frozen at
    // pre-swipe height for the entire cascade.
    const frozenPendingRows = buildFrozenSnapshot(s.grid, cfg);

    const payload: PendingCommitPayload = { grid: result.grid, [pendingKey]: result.pending };
    const pc: PendingCommit = {
      payload,
      blockedIndices,
      pendingKey,
    };

    const rowIsVisible = (idx: number): boolean => {
      if (pendingKey === 'topPending' || pendingKey === 'bottomPending')
        return s.grid.some((row) => row[cfg.PENDING_COL_START + idx] !== 0);
      return s.grid[cfg.PENDING_ROW_START + idx].some((v) => v !== 0);
    };

    const flying: FlyingTileDescriptor[] = landings
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

    // ── No animation: commit immediately ────────────────────────────────────
    if (flying.length === 0) {
      set({
        ...pc.payload,
        lastVerticalSide: newVerticalSide,
        lastHorizontalSide: newHorizontalSide,
      });
      if (checkGameOver(pc.payload.grid, cfg)) {
        const currentScore = get().score;
        const currentHighScore = get().highScore;
        const newHighScore = Math.max(currentScore, currentHighScore);
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
      return;
    }

    // ── Animate ──────────────────────────────────────────────────────────────
    set({
      pendingCommit: pc,
      flyingTiles: flying,
      flyingSource: pendingKey.replace('Pending', '') as HorizontalSide | VerticalSide,
      animating: true,
      frozenPendingRows,
    });

    setTimeout(() => {
      const cur = get();
      const { pendingCommit: commit } = cur;
      if (!commit) return;
      const { payload: commitPayload, pendingKey: pKey } = commit;

      set({
        flyingTiles: [],
        flyingSource: null,
        pendingCommit: null,
      });

      // Commit the grid and refreshed pending immediately so strip always shows 5 tiles
      const { grid: payloadGrid } = commitPayload;
      set({
        grid: payloadGrid,
        [pKey]: result.pending,
        lastVerticalSide: newVerticalSide,
        lastHorizontalSide: newHorizontalSide,
      });
      runCollapseLoop(
        payloadGrid,
        {},
        get,
        set,
        newVerticalSide,
        newHorizontalSide
      );
    }, ANIM_MS + 30);
  },
}));

export default useGameStore;
