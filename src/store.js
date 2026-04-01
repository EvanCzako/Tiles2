import { create } from 'zustand';
import {
  GRID_CONFIGS,
  createInitialGrid, createInitialPending,
  pushFromLeft, pushFromRight, pushFromTop, pushFromBottom, collapseGrid, annihilateAdjacent,
  sideCanLand, checkGameOver, nextCombo,
} from './gameLogic';
import { CELL, GAP, ANIM_MS, FLASH_MS, AUTO_MOVE_MS } from './constants';
import { getLayout, cellPos, leftPendingPos, rightPendingPos, topPendingPos, bottomPendingPos } from './layout';

function getAvailableDirections(s) {
  const { grid, disabledLeft, disabledRight, disabledTop, disabledBottom, cfg } = s;
  const dirs = [];
  if (sideCanLand(grid, disabledLeft,   cfg, 'row')) dirs.push('right');
  if (sideCanLand(grid, disabledRight,  cfg, 'row')) dirs.push('left');
  if (sideCanLand(grid, disabledTop,    cfg, 'col')) dirs.push('down');
  if (sideCanLand(grid, disabledBottom, cfg, 'col')) dirs.push('up');
  return dirs;
}

function loadHighScore() {
  if (typeof window === 'undefined') return 0;
  const saved = localStorage.getItem('tilesHighScore');
  return saved ? parseInt(saved, 10) : 0;
}

function saveHighScore(score) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('tilesHighScore', String(score));
  }
}

function initState(mode = '9x9') {
  const cfg    = GRID_CONFIGS[mode];
  const layout = getLayout(cfg);
  return {
    gridMode:       mode,
    cfg,
    layout,
    grid:           createInitialGrid(cfg),
    leftPending:    createInitialPending(cfg),
    rightPending:   createInitialPending(cfg),
    topPending:     createInitialPending(cfg),
    bottomPending:  createInitialPending(cfg),
    score:          0,
    highScore:      loadHighScore(),
    combo:          1,
    gameOver:       false,
    animating:      false,
    flyingTiles:    [],
    flyingSource:   null,
    flashSet:       new Set(),
    annihilateSet:  new Set(),
    redFlashSet:    new Set(),
    redFlashSource: null,
    collapsingCells: new Set(),
    disabledLeft:   new Set(),
    disabledRight:  new Set(),
    disabledTop:    new Set(),
    disabledBottom: new Set(),
    pendingCommit:  null,
    frozenPendingRows: null,  // snapshot of per-row activity at push time; held through cascade
  };
}

function buildFrozenSnapshot(grid, cfg) {
  const { PENDING_SIZE, PENDING_ROW_START, PENDING_COL_START, CENTER_ROW, CENTER_COL } = cfg;
  const gridEmpty = grid.every(row => row.every(v => v === 0));
  const centerRowIdx = CENTER_ROW - PENDING_ROW_START;
  const centerColIdx = CENTER_COL - PENDING_COL_START;
  const rowActive = i => grid[PENDING_ROW_START + i].some(v => v !== 0) || (gridEmpty && i === centerRowIdx);
  const colActive = i => grid.some(row => row[PENDING_COL_START + i] !== 0) || (gridEmpty && i === centerColIdx);
  return {
    left:   Array.from({ length: PENDING_SIZE }, (_, i) => rowActive(i)),
    right:  Array.from({ length: PENDING_SIZE }, (_, i) => rowActive(i)),
    top:    Array.from({ length: PENDING_SIZE }, (_, i) => colActive(i)),
    bottom: Array.from({ length: PENDING_SIZE }, (_, i) => colActive(i)),
  };
}

// ── Collapse + annihilate loop ─────────────────────────────────────────────
function runCollapseLoop(grid, pendingPayload, newDL, newDR, newDT, newDB, get, set, lastPushedSide = 'left', combo = 1) {
  const { cfg } = get();
  const { grid: collapsedGrid, midGrid, gravityMoves, horizontalMoves } = collapseGrid(grid, cfg, lastPushedSide);

  const afterCollapse = (settled) => {
    const curCfg = get().cfg;
    const { annihilatedCells, grid: annGrid, score: annScore } = annihilateAdjacent(settled, curCfg);

    if (annihilatedCells.length === 0) {
      // Cascade fully settled — transition is atomic (never passes through null)
      // to avoid Arena re-deriving visibility from a mismatched grid mid-render.
      set({ animating: false, combo: 1, frozenPendingRows: buildFrozenSnapshot(settled, curCfg), ...pendingPayload });
      if (checkGameOver(settled, newDL, newDR, newDT, newDB, curCfg)) {
        const currentScore = get().score;
        const currentHighScore = get().highScore;
        const newHighScore = Math.max(currentScore, currentHighScore);
        saveHighScore(newHighScore);
        set({ gameOver: true, highScore: newHighScore });
      } else {
        const available = getAvailableDirections(get());
        if (available.length === 1) {
          setTimeout(() => { if (!get().gameOver && !get().animating) get().triggerPush(available[0]); }, AUTO_MOVE_MS);
        }
      }
      return;
    }

    const nextCombo_ = nextCombo(combo);
    set({
      score: get().score + annScore * combo,
      combo: combo,
      annihilateSet: new Set(annihilatedCells.map(([r, c]) => `${r},${c}`)),
    });
    setTimeout(() => {
      set({ grid: annGrid, annihilateSet: new Set() });
      runCollapseLoop(annGrid, pendingPayload, newDL, newDR, newDT, newDB, get, set, lastPushedSide, nextCombo_);
    }, FLASH_MS);
  };

  // Animate horizontal phase (inward pack) after gravity has settled
  const doHorizontalPhase = () => {
    if (horizontalMoves.length === 0) {
      afterCollapse(collapsedGrid);
      return;
    }
    const curLayout = get().layout;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      set({
        flyingTiles: horizontalMoves.map((m, idx) => ({
          id: `collapse-h-${idx}`,
          value: m.value,
          from: cellPos(m.fromRow, m.fromCol, curLayout),
          to:   cellPos(m.toRow,   m.toCol,   curLayout),
          flyThrough: false,
        })),
        collapsingCells: new Set(horizontalMoves.map(m => `${m.fromRow},${m.fromCol}`)),
      });
      setTimeout(() => {
        set({ grid: collapsedGrid, flyingTiles: [], collapsingCells: new Set() });
        afterCollapse(collapsedGrid);
      }, ANIM_MS + 30);
    }));
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
  requestAnimationFrame(() => requestAnimationFrame(() => {
    set({
      flyingTiles: gravityMoves.map((m, idx) => ({
        id: `collapse-g-${idx}`,
        value: m.value,
        from: cellPos(m.fromRow, m.fromCol, curLayout),
        to:   cellPos(m.toRow,   m.toCol,   curLayout),
        flyThrough: false,
      })),
      collapsingCells: new Set(gravityMoves.map(m => `${m.fromRow},${m.fromCol}`)),
    });
    setTimeout(() => {
      set({ grid: midGrid, flyingTiles: [], collapsingCells: new Set() });
      doHorizontalPhase();
    }, ANIM_MS + 30);
  }));
}

// ── Store ───────────────────────────────────────────────────────────────────
const useGameStore = create((set, get) => ({
  ...initState(),

  reset() {
    set(initState(get().gridMode));
  },

  resetHighScore() {
    saveHighScore(0);
    set({ highScore: 0 });
  },

  setGridMode(mode) {
    set(initState(mode));
  },

  triggerPush(direction) {
    const s = get();
    if (s.animating || s.gameOver) return;
    set({ combo: 1 });

    const { cfg, layout } = s;
    let pushFn, pendingArg, pendingKey, getPendingPos;
    if (direction === 'left') {
      pushFn = pushFromRight; pendingArg = s.rightPending;
      pendingKey = 'rightPending'; getPendingPos = i => rightPendingPos(i, layout);
    } else if (direction === 'right') {
      pushFn = pushFromLeft;  pendingArg = s.leftPending;
      pendingKey = 'leftPending';  getPendingPos = i => leftPendingPos(i, layout);
    } else if (direction === 'down') {
      pushFn = pushFromTop;    pendingArg = s.topPending;
      pendingKey = 'topPending';    getPendingPos = i => topPendingPos(i, layout);
    } else if (direction === 'up') {
      pushFn = pushFromBottom; pendingArg = s.bottomPending;
      pendingKey = 'bottomPending'; getPendingPos = i => bottomPendingPos(i, layout);
    } else return;

    const disabled = pendingKey === 'leftPending'   ? s.disabledLeft
                   : pendingKey === 'rightPending'  ? s.disabledRight
                   : pendingKey === 'topPending'    ? s.disabledTop
                   : s.disabledBottom;
    const filteredPending = pendingArg.map((v, i) => disabled.has(i) ? 0 : v);
    const result = pushFn(s.grid, filteredPending, cfg);
    const { landings, mergedCells, score: pushScore, blockedIndices } = result;

    // Snapshot row activity BEFORE the push so pending columns stay frozen at
    // pre-swipe height for the entire cascade.
    const frozenPendingRows = buildFrozenSnapshot(s.grid, cfg);
    // Fully refreshed values (result.pending) are applied only when cascade settles.
    const intermediatePending = pendingArg.map((v, i) => blockedIndices.includes(i) ? v : 0);

    const pc = {
      payload:       { grid: result.grid, [pendingKey]: result.pending },
      mergedCells,
      pushScore,
      blockedIndices,
      pendingKey,
    };

    const rowIsVisible = idx => {
      if (pendingKey === 'topPending' || pendingKey === 'bottomPending')
        return s.grid.some(row => row[cfg.PENDING_COL_START + idx] !== 0);
      return s.grid[cfg.PENDING_ROW_START + idx].some(v => v !== 0);
    };

    const flying = landings
      .filter(land => !land.flyThrough || rowIsVisible(land.pendingIdx))
      .map((land, idx) => {
        const from = getPendingPos(land.pendingIdx);
        let to, flyThrough;
        if (land.flyThrough) {
          flyThrough = true;
          if (pendingKey === 'leftPending')       to = { x: layout.sideOffset + layout.gridPx + GAP * 4 + CELL, y: from.y };
          else if (pendingKey === 'rightPending') to = { x: -CELL * 2,                                            y: from.y };
          else if (pendingKey === 'topPending')   to = { x: from.x, y: layout.CONTAINER_H + CELL };
          else                                    to = { x: from.x, y: -CELL };
        } else {
          flyThrough = false;
          to = cellPos(land.row, land.col, layout);
        }
        return { id: idx, value: pendingArg[land.pendingIdx], from, to, flyThrough };
      });

    // ── No animation: commit immediately ────────────────────────────────────
    if (flying.length === 0) {
      const newDL = pendingKey === 'leftPending'   ? new Set([...s.disabledLeft,   ...blockedIndices]) : s.disabledLeft;
      const newDR = pendingKey === 'rightPending'  ? new Set([...s.disabledRight,  ...blockedIndices]) : s.disabledRight;
      const newDT = pendingKey === 'topPending'    ? new Set([...s.disabledTop,    ...blockedIndices]) : s.disabledTop;
      const newDB = pendingKey === 'bottomPending' ? new Set([...s.disabledBottom, ...blockedIndices]) : s.disabledBottom;

      set({
        ...pc.payload,
        disabledLeft:   newDL,
        disabledRight:  newDR,
        disabledTop:    newDT,
        disabledBottom: newDB,
        redFlashSet:    blockedIndices.length > 0 ? new Set(blockedIndices) : new Set(),
        redFlashSource: blockedIndices.length > 0 ? pendingKey : null,
      });
      if (blockedIndices.length > 0)
        setTimeout(() => set({ redFlashSet: new Set(), redFlashSource: null }), FLASH_MS);
      if (checkGameOver(pc.payload.grid, newDL, newDR, newDT, newDB, cfg)) {
        const currentScore = get().score + pushScore;
        const currentHighScore = get().highScore;
        const newHighScore = Math.max(currentScore, currentHighScore);
        saveHighScore(newHighScore);
        set({ gameOver: true, highScore: newHighScore });
      } else {
        const available = getAvailableDirections(get());
        if (available.length === 1) {
          setTimeout(() => { if (!get().gameOver && !get().animating) get().triggerPush(available[0]); }, AUTO_MOVE_MS);
        }
      }
      return;
    }

    // ── Animate ──────────────────────────────────────────────────────────────
    set({
      pendingCommit:  pc,
      flyingTiles:    flying,
      flyingSource:   pendingKey.replace('Pending', ''),
      animating:      true,
      frozenPendingRows,
      redFlashSet:    blockedIndices.length > 0 ? new Set(blockedIndices) : new Set(),
      redFlashSource: blockedIndices.length > 0 ? pendingKey : null,
    });

    setTimeout(() => {
      const cur = get();
      const { pendingCommit: commit } = cur;
      const { payload, mergedCells: mc, pushScore: ps, blockedIndices: blocked, pendingKey: pKey } = commit;

      const newDL = pKey === 'leftPending'   ? new Set([...cur.disabledLeft,   ...blocked]) : cur.disabledLeft;
      const newDR = pKey === 'rightPending'  ? new Set([...cur.disabledRight,  ...blocked]) : cur.disabledRight;
      const newDT = pKey === 'topPending'    ? new Set([...cur.disabledTop,    ...blocked]) : cur.disabledTop;
      const newDB = pKey === 'bottomPending' ? new Set([...cur.disabledBottom, ...blocked]) : cur.disabledBottom;

      set({
        score:          cur.score + ps,
        flyingTiles:    [],
        flyingSource:   null,
        redFlashSet:    new Set(),
        redFlashSource: null,
        disabledLeft:   newDL,
        disabledRight:  newDR,
        disabledTop:    newDT,
        disabledBottom: newDB,
        pendingCommit:  null,
      });

      if (mc.length > 0) {
        set({ flashSet: new Set(mc.map(([r, c]) => `${r},${c}`)) });
        setTimeout(() => set({ flashSet: new Set() }), FLASH_MS);
      }

      // Commit the grid + intermediate pending (used slots zeroed); hold refreshed pending for cascade end
      const { grid: payloadGrid, ...pendingPayload } = payload;
      set({ grid: payloadGrid, [pendingKey]: intermediatePending });
      
      // Determine which side was pushed to inform collapse logic
      const lastPushedSide = pKey === 'leftPending' ? 'left' : pKey === 'rightPending' ? 'right' : pKey === 'topPending' ? 'top' : 'bottom';
      runCollapseLoop(payloadGrid, pendingPayload, newDL, newDR, newDT, newDB, get, set, lastPushedSide);
    }, ANIM_MS + 30);
  },
}));

export default useGameStore;
