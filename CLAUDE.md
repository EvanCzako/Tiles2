# Tiles2 — Project Context

## Overview
A **swipe-based tile game** built as a JavaScript/React web app (deployed via gh-pages), with a parallel React Native mobile app in development. The game is titled **UNTILED** in-product.

- **Run dev server:** `npm run dev`
- **Run tests:** `npm test`
- **Deploy:** `npm run deploy` (builds then pushes to gh-pages)

## Stack
React 18 · Zustand 5 · Vite 6 · Jest 30 (node ESM, `--experimental-vm-modules`)

## Controls
- **Mobile:** Swipe up, down, left, or right (30px minimum threshold)
- **Desktop:** Arrow keys

---

## Board Layout
The active board is a **9×9 grid** with the four **2×2 corner sections removed**, forming a plus/cross shape:
- Main column: 9 rows × 5 columns
- Main row: 5 rows × 9 columns

```
  [  ][  ][  ][  ][  ]
  [  ][  ][  ][  ][  ]
[  ][  ][  ][  ][  ][  ][  ][  ][  ]
[  ][  ][  ][  ][  ][  ][  ][  ][  ]
[  ][  ][  ][  ][  ][  ][  ][  ][  ]   ← CENTER_ROW = 4
[  ][  ][  ][  ][  ][  ][  ][  ][  ]
[  ][  ][  ][  ][  ][  ][  ][  ][  ]
  [  ][  ][  ][  ][  ]
  [  ][  ][  ][  ][  ]
                 ↑ CENTER_COL = 4
```

Corner cells (`r ≤ 1 || r ≥ 7`) && (`c ≤ 1 || c ≥ 7`) are rendered with CSS class `grid-cell--corner` and are always empty.

## Pending Tiles
There are **4 pending rows/columns** (one on each side), each containing **5 tiles** aligned with rows/cols 2–6 (`PENDING_ROW_START=2`, `PENDING_COL_START=2`). On a swipe the pending strip for that side is pushed into the active area; consumed slots are zeroed during animation and filled with fresh values on cascade end.

Tile distribution: heavily favors low values — 1 (~40%), 2 (~30%), 3 (~18%), 4 (~7%), 5 (~3%), 6 (~1.5%), 7 (~0.5%). Adjacent pending tiles are never the same value.

---

## Scoring & Annihilation
After every push, any group of **2 or more orthogonally-adjacent tiles with the same value** is annihilated (removed). Score = `(count × value) × combo`.

---

## Collapse / Gravity (two-phase, runs after every push and annihilation)
Implemented in `collapseGrid()` in `src/gameLogic.js`.

**Phase 1 — Gravity (vertical, toward CENTER_ROW):**
- `lastVerticalSide` determines which half "owns" CENTER_ROW.
- `'top'` → top half packs downward so its lowest tile sits at CENTER_ROW; bottom half packs upward staying ≥ CENTER_ROW+1.
- `'bottom'` → bottom half packs upward so its topmost tile sits at CENTER_ROW; top half packs downward staying ≤ CENTER_ROW-1.
- Post-processing: any column that has live tiles but CENTER_ROW empty gets slid to fill it.

**Phase 2 — Horizontal (toward CENTER_COL):**
- Same logic on rows; `lastHorizontalSide` determines which half owns CENTER_COL.
- Post-processing: any row that has live tiles but CENTER_COL empty gets slid to fill it.

`collapseGrid` returns `{ grid, midGrid, gravityMoves, horizontalMoves }`.  
`midGrid` is the snapshot between phases (used to stage the two animation sequences).  
Both `gravityMoves` and `horizontalMoves` are arrays of `{ value, fromRow, fromCol, toRow, toCol }`.

**Key invariant (`consolidateCrossPhase`):** while-loop moves and post-processing moves for the *same physical tile* are merged into one net animation; moves that are *different tiles* that happen to share a position are never merged (regression-tested heavily in `gameLogic.test.js`).

---

## Combo & Nuke System
```
MAX_COMBO  = 5   // score cap per cascade wave
NUKE_COMBO = 6   // sentinel that triggers the nuke instead of recursing
```

- Combo starts at 1 per turn and increments each cascade wave via `nextCombo(combo)`, capped at NUKE_COMBO.
- Score per wave: `annScore × min(combo, MAX_COMBO)`.
- **Nuke:** when `nextCombo` would reach `NUKE_COMBO` (i.e. the 5th consecutive cascade), `nukeCenterAndSettle` fires instead of another collapse loop:
  1. Gold-flash the full center cross (entire row 4 + entire col 4).
  2. Clear only the non-empty cross cells and score them × MAX_COMBO (5).
  3. Run one final collapse loop with `nukeUsed=true` (prevents a second nuke in the same turn).

---

## Animation System
All animation is coordinate-based — tiles animate between pixel positions computed by `layout.js`.

**Key constants:**
- `CELL = 52` px, `GAP = 4` px
- `ANIM_MS = 220` ms (fly/collapse transition)
- `FLASH_MS = 320` ms (annihilation/nuke gold flash hold)
- `AUTO_MOVE_MS = 500` ms (delay before auto-move when only 1 direction available)

**FlyingTile** (`src/components/FlyingTile.jsx`): absolutely-positioned div, starts at `from` position via CSS `translate`, transitions to `(0,0)` (i.e. `to`). Uses double-rAF to trigger the CSS transition after mount. Fly-through tiles fade to opacity 0 mid-flight.

**Collapse animation** is two-stage: gravity moves animate first, then horizontal moves, each separated by `ANIM_MS + 30` ms.

**Flash:** `annihilateSet` in store holds `"r,c"` strings → Tile renders `tile--flash-annihilate` CSS class (gold).

**`collapsingCells`:** set of cells hidden during a collapse animation (their flying counterpart is visible instead).

---

## Zustand Store State (`src/store.js`)
```js
grid                // 9×9 number array (0 = empty)
leftPending / rightPending / topPending / bottomPending  // number[5]
score / highScore / combo
gameOver / animating
flyingTiles         // FlyingTile descriptor array
flyingSource        // 'left'|'right'|'top'|'bottom'|null — which side is currently flying
annihilateSet       // Set<"r,c"> — cells currently gold-flashing
collapsingCells     // Set<"r,c"> — cells hidden during collapse animation
pendingCommit       // { payload, blockedIndices, pendingKey } — held during push animation
frozenPendingRows   // snapshot of per-row/col activity at push time; held through entire cascade
lastVerticalSide    // 'top'|'bottom'
lastHorizontalSide  // 'left'|'right'
cfg / layout / gridMode
```

**Key store helpers (module-level, not exported):**
- `endTurn(grid, pendingPayload, get, set)` — atomic end-of-turn update; checks game over; triggers auto-move if only 1 direction available.
- `runCollapseLoop(...)` — recursive cascade (combo 1→4); calls `nukeCenterAndSettle` when `nextCombo === NUKE_COMBO`.
- `nukeCenterAndSettle(...)` — nuke flash → clear → `runCollapseLoop` with `nukeUsed=true`.

High score is persisted to `localStorage` key `'tilesHighScore'`.

---

## Screen Navigation (`src/App.jsx`)
Simple `useState('menu')` router. Screens: `'menu'` → `'game'` | `'howToPlay'` | `'settings'`. Each screen receives `navigate` prop.

## Components
| File | Role |
|------|------|
| `Arena.jsx` | Grid + 4 pending strips + flying tiles; reads `frozenPendingRows` to stabilize visibility during cascade |
| `Tile.jsx` | Single tile div; props: `value`, `size`, `flashing`, `flashAnnihilate`, `centerColumn` |
| `FlyingTile.jsx` | Animated flying tile (CSS transition via double-rAF) |
| `GameScreen.jsx` | Computes `scale` via `useScale`, mounts `useInput`, renders header + arena |
| `GameHeader.jsx` | Score / highScore / combo display; combo color ramp (grey→yellow→orange→red-orange→red) |
| `GameOverOverlay.jsx` | Overlay with Play Again + Main Menu |
| `MenuScreen.jsx` | Title "UNTILED" + Play / How to Play / Settings buttons |
| `HowToPlayScreen.jsx` | Static rule cards |
| `SettingsScreen.jsx` | Grid mode selector (currently only `'9x9'`) + high score reset |

## Hooks
- `useInput(triggerPush)` — keyboard (ArrowKeys) + touch (touchstart/touchend, 30px threshold)
- `useScale(containerW, containerH)` — responsive scale factor; listens to ResizeObserver + visualViewport + orientationchange; sets `--app-h` CSS var; clamps to [0.28, 1]

## Layout (`src/layout.js`)
`getLayout(cfg)` → layout object with pixel positions for the container, grid, and all four pending strips. Helper fns: `cellPos`, `leftPendingPos`, `rightPendingPos`, `topPendingPos`, `bottomPendingPos`.

## Tile Colors (`getTileColor` in `gameLogic.js`)
1→blue, 2→teal, 3→green, 4→yellow-green, 5→yellow, 6→orange, 7→red-orange, 8→red, 9→magenta, 10→purple. Values > 10 fall back to white/dark.

---

## Testing
`src/gameLogic.test.js` — pure logic tests (no React). Run with `npm test`.  
Covers: constants, grid init, push from all 4 sides, gravity/horizontal collapse, annihilation, game-over detection, nuke cross score, combo math, and regression tests for the `consolidateCrossPhase` animation merge bug (same-value tiles in the same pass must never be chained).

---

## Mobile Port
Expo port at `/Users/evanczako/Documents/Code-ish/Tile Games/Tiles2-Mobile`.  
Stack: Expo SDK 54, React Native 0.81, Reanimated v4, Gesture Handler v2, AsyncStorage, Zustand 5.  
Run: `cd Tiles2-Mobile && npx expo start`
