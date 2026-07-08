# Tiles2 — Project Context

## Overview
A **swipe-based tile game** built as a TypeScript/React web app (deployed via gh-pages), with a parallel React Native mobile app in development. The game is titled **UNTILED** in-product.

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
The active board is a **9×9 grid** (or **11×11** in the alternate mode). The four corner 2×2 blocks are **corner obstacle regions** — filled with tiles that act as obstacles and have their own gravity system (see below). The central cross/plus shape is the main play area.

For 9×9:
- Main column: 9 rows × 5 columns
- Main row: 5 rows × 9 columns

```
  [##][##][  ][  ][  ][  ][  ][##][##]
  [##][##][  ][  ][  ][  ][  ][##][##]
[  ][  ][  ][  ][  ][  ][  ][  ][  ]
[  ][  ][  ][  ][  ][  ][  ][  ][  ]
[  ][  ][  ][  ][  ][  ][  ][  ][  ]   ← CENTER_ROW = 4
[  ][  ][  ][  ][  ][  ][  ][  ][  ]
[  ][  ][  ][  ][  ][  ][  ][  ][  ]
  [##][##][  ][  ][  ][  ][  ][##][##]
  [##][##][  ][  ][  ][  ][  ][##][##]
                 ↑ CENTER_COL = 4
```
`[##]` = corner obstacle cells (rows `r < PENDING_ROW_START || r >= PENDING_ROW_START + PENDING_SIZE` AND cols `c < PENDING_COL_START || c >= PENDING_COL_START + PENDING_SIZE`).

Corner cells are identified by `isCornerCell(r, c, cfg)` (exported from `gameLogic.ts`). They are rendered with CSS class `grid-cell--corner` (and `grid-cell--corner--empty` when their value is 0).

## Grid Configs (`GRID_CONFIGS` in `gameLogic.ts`)
| Mode | ROWS | COLS | PENDING_SIZE | PENDING_ROW_START | PENDING_COL_START | CENTER_ROW | CENTER_COL |
|------|------|------|------|------|------|------|------|
| `'9x9'` | 9 | 9 | 5 | 2 | 2 | 4 | 4 |
| `'11x11'` | 11 | 11 | 7 | 2 | 2 | 5 | 5 |

## Pending Tiles
There are **4 pending rows/columns** (one on each side), each containing `PENDING_SIZE` tiles aligned with rows/cols `PENDING_ROW_START` through `PENDING_ROW_START + PENDING_SIZE - 1`. On a swipe the pending strip for that side is pushed into the active area. Refreshed pending values are committed immediately (the strip always shows a full set of tiles — no zeroing during cascade).

All 5 pending tiles always land on push, even if a row/column is entirely empty (no fly-throughs).

Tile distribution: moderately favors low values — 1 (~33%), 2 (~24%), 3 (~16%), 4 (~10%), 5 (~7%), 6 (~6%), 7 (~4%). Adjacent pending tiles are never the same value.

---

## Corner Obstacle Mechanic
The four 2×2 corner blocks start populated with random tiles. After each turn's cascade settles, `settleCorners(grid, cfg)` runs a two-phase gravity on each corner block:

- **Phase 1 (vertical):** Each column in a corner block — if the inner row is empty and the outer row is not — slides the outer tile to the inner row.
- **Phase 2 (horizontal):** Each row in a corner block — if the inner col is empty and the outer col is not — slides the outer tile to the inner col.
- After both phases, any remaining empty slots are refilled with random tiles (no adjacent duplicates).

Corner phases are animated sequentially (same `ANIM_MS + 30` timing as main collapse). After corner settlement, if new tile placements created matches, `runCollapseLoop` re-enters the cascade.

Corner cells are **excluded from all main-grid collapse logic** (`collapseGrid` and post-processing skips any cell where `isCornerCell` is true).

`settleCorners` returns `{ grid, movedGrid, midGrid, verticalMoves, horizontalMoves }`.
- `midGrid` — after vertical slides only (used to stage phase 1 animation commit)
- `movedGrid` — after both slide phases but **before** refill (committed first so new tiles never appear during animation)
- `grid` — fully settled including refill (used for cascade check and final state)

---

## Scoring & Annihilation
Two-tier system checked after every push and collapse wave:

- **Group of 2** — only those 2 connected tiles are annihilated. Score = `2 × value`.
- **Group of 3+** — every tile of that value **anywhere on the board** (including corner 2×2 regions) is annihilated. Score = `total_count × value`.

Multiple values can trigger in the same wave independently. Score per wave is multiplied by `combo`.

`annihilateAdjacent` returns `{ grid, annihilatedCells, score, boardWipeGroupCells, boardWipeSpreadCells, regularCells }`:
- `boardWipeGroupCells` — the triggering 3+ connected group (flashes first)
- `boardWipeSpreadCells` — all other matching tiles swept board-wide (flash 150 ms later)
- `regularCells` — 2-tile group cells (no board-wide wipe)

---

## Collapse / Gravity (two-phase, runs after every push and annihilation)
Implemented in `collapseGrid()` in `src/gameLogic.ts`. Corner cells are immovable obstacles and are excluded from tile lists and never zeroed.

**Phase 1 — Gravity (vertical, toward CENTER_ROW):**
- `lastVerticalSide` determines which half "owns" CENTER_ROW.
- `'top'` → top half packs downward so its lowest tile sits at CENTER_ROW; bottom half packs upward staying ≥ CENTER_ROW+1.
- `'bottom'` → bottom half packs upward so its topmost tile sits at CENTER_ROW; top half packs downward staying ≤ CENTER_ROW-1.
- Post-processing: any column that has live non-corner tiles but CENTER_ROW empty gets slid to fill it.

**Phase 2 — Horizontal (toward CENTER_COL):**
- Same logic on rows; `lastHorizontalSide` determines which half owns CENTER_COL.
- Post-processing: any row that has live non-corner tiles but CENTER_COL empty gets slid to fill it.

`collapseGrid` returns `{ grid, midGrid, gravityMoves, horizontalMoves }`.  
`midGrid` is the snapshot between phases (used to stage the two animation sequences).  
Both `gravityMoves` and `horizontalMoves` are arrays of `{ value, fromRow, fromCol, toRow, toCol }`.

**Key invariant (`consolidateCrossPhase`):** while-loop moves and post-processing moves for the *same physical tile* are merged into one net animation; moves that are *different tiles* that happen to share a position are never merged (regression-tested heavily in `gameLogic.test.ts`).

---

## Combo System
```
MAX_COMBO = 5   // combo (and score multiplier) cap per cascade wave
```

- Combo starts at 1 per turn and increments each cascade wave via `nextCombo(combo)`, capped at MAX_COMBO.
- Score per wave: `annScore × min(combo, MAX_COMBO)`.

## Player Abilities (combo strip buttons)
```
NUKE_CHARGE_MAX = 12   // charge points to fill the nuke meter
REROLL_COOLDOWN = 10   // turns between pending-strip rerolls
```

- **Chargeable nuke:** each annihilation wave adds its combo multiplier to `nukeCharge` (capped at NUKE_CHARGE_MAX; a chime plays when it fills). The NUKE button (left of the combo badge) shows `☢ N/12`, pulses when full, and fires via click or **Space** (`fireNuke` action):
  1. Red-orange flash (`nukeFlashSet`) the full center cross (entire row CENTER_ROW + entire col CENTER_COL), big screen shake, "NUKE!" announcement.
  2. Clear only the non-empty cross cells and score them × MAX_COMBO (5) — `nukeCrossScore` uses base values so specialty flags don't inflate the score.
  3. Run the collapse loop at combo = MAX_COMBO with `chargeNuke=false` (nuke fallout can't recharge the meter; charging resumes next turn).
- **Strip reroll (SWAP):** the SWAP button (right of the combo badge) arms strip-pick mode (`rerollArmed`) — all four pending strips pulse; tapping one rerolls it (`rerollStrip(side)`, fresh `createInitialPending`) and starts a REROLL_COOLDOWN-turn cooldown (`turnsUntilReroll`, decremented per push, shown on the button). Arming is a toggle; pushing disarms.

## Clean Sweep
```
CLEAN_SWEEP_BONUS_PER_TILE = 25
```
When a turn empties the **entire play area** (`isPlayAreaEmpty` in `game/grid.ts` — every non-corner cell 0; corners are excluded because they refill themselves), `endTurn` awards, once per turn (`cleanSweepAwarded` flag):
- **Bonus** = `CLEAN_SWEEP_BONUS_PER_TILE × turnClearedTiles × min(combo, MAX_COMBO)`. `turnClearedTiles` accumulates per turn across cascade waves and nuke clears (unlocked-not-cleared tiles excluded); reset on push/fireNuke.
- **Fully charged nuke** (`nukeCharge = NUKE_CHARGE_MAX`).
- Juice: gold "CLEAN SWEEP!" announcement, big shake, ascending fanfare (`playCleanSweep`), `+bonus` popup at center.
The check runs at the top of `endTurn`, before corner settlement, so corner-refill cascades can't re-trigger it.

---

## Animation System
All animation is coordinate-based — tiles animate between pixel positions computed by `layout.ts`.

**Key constants:**
- `CELL = 52` px, `GAP = 4` px
- `ANIM_MS = 220` ms (fly/collapse transition)
- `FLASH_MS = 320` ms (annihilation/nuke flash hold)
- `AUTO_MOVE_MS = 500` ms (delay before auto-move when only 1 direction available — **suppressed** while the player has a usable ability: charged nuke or ready reroll; see `canUseAbility`/`scheduleAutoMoveIfForced` in `store/init.ts`. Spending the reroll re-schedules it.)
- `POPUP_MS = 900` / `SHAKE_MS = 450` / `ANNOUNCE_MS = 1000` ms (juice element lifetimes)
- `HEADER_H = 92` px (header 52 px + combo strip 40 px; used by `useScale` to compute available board space)
- `COMBO_COLORS` (constants.ts) — combo color ramp shared by the combo badge and score popups

**FlyingTile** (`src/components/FlyingTile.tsx`): absolutely-positioned div, starts at `from` position via CSS `translate`, transitions to `(0,0)` (i.e. `to`). Uses double-rAF to trigger the CSS transition after mount.

**Collapse animation** is two-stage: gravity moves animate first, then horizontal moves, each separated by `ANIM_MS + 30` ms. Corner settle uses the same two-stage pattern.

**Flash types** (all hold for `FLASH_MS` then grid is zeroed):
- `annihilateSet` → `tile--flash-annihilate` — gold/white overlay (regular 2-tile annihilation)
- `boardWipeFlashSet` → `tile--flash-boardwipe` — value-colored brightness pop (3+ board-wide wipe); group cells flash first, spread cells join 150 ms later
- `nukeFlashSet` → `tile--flash-nuke` — red-orange overlay (nuke cross clear)

**`collapsingCells`:** set of cells hidden during a collapse animation (their flying counterpart is visible instead).

## Juice (sound / popups / shake / announcer)
- **Sound** (`src/sound.ts`): synthesized WebAudio (no assets), lazily created inside user gestures. `playPush`, `playMatch(combo)` (pentatonic pitch ramp per cascade wave), `playBoardWipe`, `playBomb`, `playNuke`, `playNukeReady`, `playReroll`, `playGameOver`. Global on/off via `setSoundEnabled`; persisted to localStorage (`tilesSoundOn`) and toggleable in Settings (`soundOn` / `setSoundOn`).
- **Score popups** (`scorePopups` in store): floating `+N` per annihilation wave (and per nuke), spawned by `spawnScorePopup` at the centroid of the cleared cells (arena pixel coords), sized/colored by combo tier, rendered by `Arena` (`.score-popup`), removed after `POPUP_MS`.
- **Screen shake** (`shake`): `{ tier: 'small' | 'big', id }` — small on bomb blasts, big on nuke; `GameScreen` applies `shake-small`/`shake-big` to `.arena-container`, cleared after `SHAKE_MS`.
- **Announcer** (`announcement`): `{ text, id, color? }` — "ALL Ns!" on 3+ wipes (glow tinted to the wiped value's tile color; multiple values join as "ALL 3s & 5s!"), "NUKE!" on nuke (default red-orange glow); rendered centered over `.arena-container` (`.announcement`), cleared after `ANNOUNCE_MS`.

---

## Zustand Store State (`src/store.ts`)
```ts
grid                // ROWS×COLS number array (0 = empty)
leftPending / rightPending / topPending / bottomPending  // number[PENDING_SIZE]
score / highScore / combo
gameOver / animating
flyingTiles         // FlyingTile descriptor array
flyingSource        // 'left'|'right'|'top'|'bottom'|null — which side is currently flying
annihilateSet       // Set<"r,c"> — cells gold-flashing (regular 2-tile annihilation)
boardWipeFlashSet   // Set<"r,c"> — cells value-colored flashing (3+ board-wide wipe)
nukeFlashSet        // Set<"r,c"> — cells red-orange flashing (nuke cross)
nukeActive          // boolean — true while nuke flash is live (reserved for future use)
collapsingCells     // Set<"r,c"> — cells hidden during collapse animation
pendingCommit       // { payload, blockedIndices, pendingKey } — held during push animation
frozenPendingRows   // snapshot of per-row/col activity at push time (used internally, not read by Arena for visibility)
lastVerticalSide    // 'top'|'bottom'
lastHorizontalSide  // 'left'|'right'
cfg / layout / gridMode
nukeCharge          // 0..NUKE_CHARGE_MAX — manual nuke fires when full (fireNuke action / Space)
rerollArmed         // true while picking a strip to reroll
turnsUntilReroll    // reroll cooldown; 0 = ready
turnClearedTiles / cleanSweepAwarded  // per-turn clean-sweep tracking (see Clean Sweep)
scorePopups         // ScorePopup[] — floating "+N" indicators
shake               // { tier: 'small'|'big', id } | null — screen shake trigger
announcement        // { text, id, color? } | null — "ALL Ns!" / "NUKE!" banner
soundOn             // sound toggle (persisted)
```

**Key store helpers (in `store/animations.ts`):**
- `endTurn(grid, pendingPayload, get, set)` — runs `settleCorners`, animates both corner phases, then calls `finalize` or re-enters cascade if corner refill created matches.
- `runCollapseLoop(..., combo, chargeNuke)` — recursive cascade; accrues nuke charge, plays sounds, spawns popups/shake/announcements per wave. `chargeNuke=false` for nuke-initiated cascades.
- `nukeCenterAndSettle(...)` — nuke flash/sound/shake/announcement → clear cross → `runCollapseLoop` at combo MAX_COMBO with `chargeNuke=false`. Invoked only by the `fireNuke` store action.

High scores are persisted per grid mode to `localStorage` key `'tilesHighScores'` as a JSON object (`{ '9x9': number, '11x11': number, ... }`).

---

## Screen Navigation (`src/App.tsx`)
Simple `useState('menu')` router. Screens: `'menu'` → `'game'` | `'howToPlay'` | `'settings'`. Each screen receives `navigate` prop. The "UNTILED" title in `GameHeader` is also clickable and navigates back to menu.

## Combo Strip
A 40 px flex strip sits between `GameHeader` and the arena in `GameScreen`. It is always present (prevents layout shift) and holds three zones: the NUKE charge button (left), the combo badge slot (center), and the SWAP/reroll button (right). When `combo >= 2` the center renders an animated `×N` badge (CSS class `combo-strip-badge`) using `COMBO_COLORS` (grey→yellow→orange→red-orange→red). `key={combo}` on the badge triggers a fresh scale-pop animation on each increment. The strip height is included in `HEADER_H` so `useScale` accounts for it.

## Source Layout
```
src/
  game/           ← pure game logic (no React, no browser APIs)
    config.ts     — GRID_CONFIGS, DEFAULT_CFG, top-level ROWS/COLS constants
    tiles.ts      — randTileSide*, getTileColor, createInitialPending
    grid.ts       — createInitialGrid, isPlayAreaEmpty
    corners.ts    — isCornerCell, getCornerBlockSpecs, settleCorners
    push.ts       — pushFromLeft/Right/Top/Bottom, checkGameOver
    collapse.ts   — collapseGrid (+ private consolidateCrossPhase)
    annihilate.ts — annihilateAdjacent
    combo.ts      — MAX_COMBO, NUKE_CHARGE_MAX, REROLL_COOLDOWN, nextCombo, nukeCrossScore
    index.ts      — re-exports all of the above
  store/          ← Zustand store, split by concern
    persistence.ts — localStorage high score helpers
    init.ts       — initState, buildFrozenSnapshot, getAvailableDirections
    animations.ts — endTurn, runCollapseLoop, nukeCenterAndSettle
    index.ts      — useGameStore (triggerPush + store creation)
  components/     ← React components (unchanged)
  hooks/          ← useInput, useScale (unchanged)
  gameLogic.ts    — barrel re-export of src/game/index (backward compat)
  store.ts        — barrel re-export of src/store/index (backward compat)
  types.ts        — all shared TypeScript types
  constants.ts    — CELL, GAP, animation/juice timings, COMBO_COLORS
  sound.ts        — synthesized WebAudio SFX (see Juice section)
  layout.ts       — getLayout, cellPos, *PendingPos helpers
```

## Components
| File | Role |
|------|------|
| `Arena.tsx` | Grid + 4 pending strips + flying tiles + score popups; reads `annihilateSet`, `boardWipeFlashSet`, `nukeFlashSet` to drive flash props on Tile; strips are clickable when `rerollArmed` |
| `Tile.tsx` | Single tile div; props: `value`, `size`, `flashing`, `flashAnnihilate`, `flashBoardWipe`, `flashNuke`, `centerColumn` |
| `FlyingTile.tsx` | Animated flying tile (CSS transition via double-rAF) |
| `GameScreen.tsx` | Computes `scale` via `useScale`, mounts `useInput`, renders header + combo strip (nuke/combo/reroll) + arena; applies shake class and announcement overlay |
| `GameHeader.tsx` | Score / highScore display; title is clickable (navigates to menu via `onMenu` prop) |
| `GameOverOverlay.tsx` | Overlay with Play Again + Main Menu |
| `MenuScreen.tsx` | Title "UNTILED" + decorative mini-tile row + Play / How to Play / Settings buttons + best-score badge |
| `HowToPlayScreen.tsx` | Rule cards (icon + text + mini `Tile` examples) covering push, annihilation, combos, nuke, swap, bombs/stones, corners, game over |
| `SettingsScreen.tsx` | Card-based: sound toggle switch, color palette, high score + reset. Grid-size selector hidden while `GridMode` allows a single mode |

## Hooks
- `useInput(triggerPush, fireNuke?)` — keyboard (ArrowKeys push, Space fires nuke) + touch (touchstart/touchend, 30px threshold)
- `useScale(containerW, containerH)` — responsive scale factor; listens to ResizeObserver + visualViewport + orientationchange; sets `--app-h` CSS var; clamps to [0.28, 1]

## Layout (`src/layout.ts`)
`getLayout(cfg)` → layout object with pixel positions for the container, grid, and all four pending strips. Helper fns: `cellPos`, `leftPendingPos`, `rightPendingPos`, `topPendingPos`, `bottomPendingPos`.

## Tile Colors (`getTileColor` in `gameLogic.ts`)
1→blue, 2→teal, 3→green, 4→yellow-green, 5→yellow, 6→orange, 7→red-orange, 8→red, 9→magenta, 10→purple. Values > 10 fall back to white/dark.

---

## Testing
`src/gameLogic.test.ts` — pure logic tests (no React). Run with `npm test`.  
Covers: constants, grid init, push from all 4 sides, gravity/horizontal collapse, annihilation (including board-wide wipe: 3+ connected group triggers full-value sweep; 2-tile groups remain local), game-over detection, nuke cross score, combo math, and regression tests for the `consolidateCrossPhase` animation merge bug (same-value tiles in the same pass must never be chained).

---

## Mobile Port
Expo port at `/Users/evanczako/Documents/Code-ish/Tile Games/Tiles2-Mobile`.  
Stack: Expo SDK 54, React Native 0.81, Reanimated v4, Gesture Handler v2, AsyncStorage, Zustand 5.  
Run: `cd Tiles2-Mobile && npx expo start`
