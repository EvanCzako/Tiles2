# Tiles2 — Project Context

## Overview
A **swipe-based tile game** built as a TypeScript/React web app (deployed via gh-pages), with a parallel React Native mobile app in development. The game is titled **UNTILED** in-product.

- **Run dev server:** `npm run dev`
- **Run tests:** `npm test`
- **Typecheck:** `npm run typecheck` (`vite build` does *not* typecheck)
- **Lint:** `npm run lint`
- **All three:** `npm run check` — same gate CI runs before deploying
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

Corner cells are identified by `isCornerCell(r, c, cfg)` (exported from `src/game/corners.ts`). They are rendered with CSS class `grid-cell--corner` (and `grid-cell--corner--empty` when their value is 0).

## Grid Configs (`GRID_CONFIGS` in `src/game/config.ts`)
| Mode | ROWS | COLS | PENDING_SIZE | PENDING_ROW_START | PENDING_COL_START | CENTER_ROW | CENTER_COL |
|------|------|------|------|------|------|------|------|
| `'7x7'` | 7 | 7 | 3 | 2 | 2 | 3 | 3 |
| `'9x9'` | 9 | 9 | 5 | 2 | 2 | 4 | 4 |
| `'11x11'` | 11 | 11 | 7 | 2 | 2 | 5 | 5 |

All three are selectable via the **Boards** menu path (`GridMode = '7x7' | '9x9' | '11x11'`); `'9x9'` is the default. Corner blocks are always 2×2 (`PENDING_ROW_START = 2`); only the central cross width (`PENDING_SIZE`, i.e. the pending-strip length) and overall size differ. Tile distributions are **tuned per-size** so all three boards play at 9×9-like difficulty (see the Difficulty ramp section — smaller boards spawn fewer distinct values, the largest ramps stones faster). All layout/rendering is `cfg`-driven, so `useScale` fits each size to the viewport.

## Pending Tiles
There are **4 pending rows/columns** (one on each side), each containing `PENDING_SIZE` tiles aligned with rows/cols `PENDING_ROW_START` through `PENDING_ROW_START + PENDING_SIZE - 1`. On a swipe the pending strip for that side is pushed into the active area. Refreshed pending values are committed immediately (the strip always shows a full set of tiles — no zeroing during cascade).

All 5 pending tiles always land on push, even if a row/column is entirely empty (no fly-throughs),
so every `Landing` carries a concrete `row`/`col`; a tile that cannot be placed is reported in
`PushResult.blockedIndices` instead.

### Difficulty ramp (`rampedSpawn`/`setDifficulty` in `game/tiles.ts`)
Spawn odds evolve with **turns survived** (`turnCount`), because survival is governed by
*match scarcity* — two same-value tiles must land adjacent to clear. The ramp is
**per-board**: the store (before each push, in `triggerPush`) and the simulator (per turn)
both call `setDifficulty(turn, gridMode)`, so each size follows its own tuned curve.
`rampedSpawn(turn, board)` returns `{ weights, bomb, stone, locked }`. Two levers do the
work: the per-board **value count** (fewer values → more matches → longer survival) and the
**stone ramp** (3% → 22%, the unbounded clutter lever that caps runaway games). Bomb is
flat; locked fades in late. Knobs sit at the top of the ramp block in `game/tiles.ts`;
retune with `npm run sim -- boards`.

**→ Rationale, per-board numbers, and how to add a board size: [`docs/balance.md`](docs/balance.md)** —
read it before changing any spawn/ramp constant; the values are sim-tuned and the reasoning
is not recoverable from the code.

Adjacent pending tiles are never the same value: a refreshed slot excludes **both**
neighbours. Excluding only the previous one was not enough — a blocked slot keeps
its old value and never regenerates, so a slot refreshed just before it could be
handed that same value (regression-tested in `gameLogic.test.ts`).
Value exclusion (`randTileSideExcluding`)
is best-effort rejection sampling capped at 20 draws — if the exclusions cover nearly the
whole spawn table it returns the first allowed value (and, failing that, any value) rather
than looping forever.

---

## Corner Obstacle Mechanic
The four 2×2 corner blocks start populated with random tiles. After each turn's cascade settles, `settleCorners(grid, cfg)` runs a two-phase gravity on each corner block:

- **Phase 1 (vertical):** Each column in a corner block — if the inner row is empty and the outer row is not — slides the outer tile to the inner row.
- **Phase 2 (horizontal):** Each row in a corner block — if the inner col is empty and the outer col is not — slides the outer tile to the inner col.
- After both phases, any remaining empty slots are refilled via `randTileSideExcluding` (no adjacent duplicates within the corner block).

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
Implemented in `collapseGrid()` in `src/game/collapse.ts`. Corner cells are immovable obstacles and are excluded from tile lists and never zeroed.

**Phase 1 — Gravity (vertical, toward CENTER_ROW):**
- `lastVerticalSide` determines which half "owns" CENTER_ROW.
- `'top'` → top half packs downward so its lowest tile sits at CENTER_ROW; bottom half packs upward staying ≥ CENTER_ROW+1.
- `'bottom'` → bottom half packs upward so its topmost tile sits at CENTER_ROW; top half packs downward staying ≤ CENTER_ROW-1.
- Post-processing: any column that has live non-corner tiles but CENTER_ROW empty gets slid to fill it.

**Phase 2 — Horizontal (toward CENTER_COL):**
- Same logic on rows; `lastHorizontalSide` determines which half owns CENTER_COL.
- Post-processing: any row that has live non-corner tiles but CENTER_COL empty gets slid to fill it.

`collapseGrid` returns `{ grid, midGrid, gravityMoves, horizontalMoves, stages }`.
- `gravityMoves` — the initial vertical pass (animated first).
- `midGrid` — snapshot after the vertical pass (committed before the rest phase animates).
- `horizontalMoves` — the first horizontal pass (kept for the common single-pass case + tests).
- `stages` — `CollapseStage[]`, the **ordered** post-gravity passes. Each stage is `{ moves, grid }` where `moves` is a single-axis batch (all horizontal or all vertical) and `grid` is the snapshot to commit once that stage's animation finishes. `stages[0]` is the first horizontal pass; extra vertical/horizontal passes follow when obstacles (stones/corners) require more than one pass to settle.

All moves are `{ value, fromRow, fromCol, toRow, toCol }`.

**Key invariant (no diagonal slides):** a tile's journey can span several vertical/horizontal sub-passes (e.g. a tile blocked by a stone slides sideways, then drops). Each pass is emitted as its own stage and animated sequentially — **never merged into one net move**. Merging a horizontal pass with a later vertical pass for the same tile would yield a move whose row *and* column both change, which the straight-line flying-tile animation would render as a diagonal cut across the board. Sequential single-axis staging guarantees every animated move is strictly horizontal or vertical (regression-tested in `src/game/gameLogic.test.ts`).

---

## Combo System
```
MAX_COMBO = 8   // combo (and score multiplier) cap per cascade wave
```

- Combo starts at 1 per turn and increments each cascade wave via `nextCombo(combo)`, capped at MAX_COMBO.
- Score per wave: `annScore × min(combo, MAX_COMBO)`.

## Player Abilities (combo strip button)
```
NUKE_CHARGE_MAX     = 64   // charge points to arm the nuke meter
NUKE_DECAY_PER_PUSH = 2    // charge lost per push while armed (use-it-or-lose-it)
```
The nuke is the only player ability (tuned July 2026 for arcade-length runs — see `scripts/simulate.ts`; the strip-reroll/SWAP ability was removed and the clean sweep no longer refills the meter).

- **Chargeable nuke:** each annihilation wave adds its combo multiplier to `nukeCharge` while unarmed (a chime plays when the meter fills). At NUKE_CHARGE_MAX the meter **arms** (`nukeArmed`): charging stops and every push drains NUKE_DECAY_PER_PUSH — if it drains to 0 the nuke is lost and recharging restarts from empty. The nuke is full strength at any armed charge level; the draining bar is only a countdown. The NUKE button (left of the combo badge) shows `☢ N/64`, pulses while armed, and fires via click or **Space** (`fireNuke` action, gated on `nukeArmed`):
  1. Red-orange flash (`nukeFlashSet`) of the blast shape — a **5×5 plus** at the board center (`nukePlusCells`: center cell + its 2 nearest orthogonal neighbours in each of the 4 directions) — big screen shake, "NUKE!" announcement.
  2. Clear only the non-empty plus cells and score them × MAX_COMBO (8) — `nukeCrossScore` uses base values so specialty flags don't inflate the score.
  3. Run the collapse loop at combo = MAX_COMBO with `chargeNuke=false` (nuke fallout can't recharge the meter; charging resumes next turn).

## Clean Sweep
```
CLEAN_SWEEP_BONUS_PER_TILE = 25
```
When a turn empties the **entire play area** (`isPlayAreaEmpty` in `game/grid.ts` — every non-corner cell 0; corners are excluded because they refill themselves), `endTurn` awards, once per turn (`cleanSweepAwarded` flag):
- **Bonus** = `CLEAN_SWEEP_BONUS_PER_TILE × turnClearedTiles × min(combo, MAX_COMBO)`. `turnClearedTiles` accumulates per turn across cascade waves and nuke clears (unlocked-not-cleared tiles excluded); reset on push/fireNuke. Score bonus only — the sweep no longer refills the nuke meter.
- Juice: gold "CLEAN SWEEP!" announcement, big shake, ascending fanfare (`playCleanSweep`), `+bonus` popup at center.
The check runs at the top of `endTurn`, before corner settlement, so corner-refill cascades can't re-trigger it.

---

## Animation System
All animation is coordinate-based — tiles animate between pixel positions computed by `layout.ts`.

**Key constants:**
- `CELL = 52` px, `GAP = 4` px
- `ANIM_MS = 220` ms (fly/collapse transition)
- `FLASH_MS = 320` ms (annihilation/nuke flash hold)
- `POPUP_MS = 900` / `SHAKE_MS = 450` / `ANNOUNCE_MS = 1000` ms (juice element lifetimes)
- `HEADER_H = 92` px (header 52 px + combo strip 40 px; used by `useScale` to compute available board space)
- `COMBO_COLORS` (constants.ts) — combo color ramp shared by the combo badge and score popups

**FlyingTile** (`src/components/FlyingTile.tsx`): absolutely-positioned div, starts at `from` position via CSS `translate`, transitions to `(0,0)` (i.e. `to`). Uses double-rAF to trigger the CSS transition after mount.

**Collapse animation** is two-stage: gravity moves animate first, then horizontal moves, each separated by `ANIM_MS + 30` ms. Corner settle uses the same two-stage pattern.

**Flash types** (all hold for `FLASH_MS` then grid is zeroed):
- `annihilateSet` → `tile--flash-annihilate` — gold/white overlay (regular 2-tile annihilation)
- `boardWipeFlashSet` → `tile--flash-boardwipe` — value-colored brightness pop (3+ board-wide wipe); group cells flash first, spread cells join 150 ms later
- `nukeFlashSet` → `tile--flash-nuke` — red-orange overlay (nuke plus clear)

**`collapsingCells`:** set of cells hidden during a collapse animation (their flying counterpart is visible instead).

## Juice (sound / popups / shake / announcer)
- **Sound** (`src/sound.ts`): synthesized WebAudio (no assets), lazily created inside user gestures. `playPush`, `playMatch(combo)` (pentatonic pitch ramp per cascade wave), `playBoardWipe`, `playBomb`, `playNuke`, `playNukeReady`, `playGameOver`. Global on/off via `setSoundEnabled`; persisted to localStorage (`tilesSoundOn`) and toggleable in Settings (`soundOn` / `setSoundOn`).
- **Score popups** (`scorePopups` in store): floating `+N` per annihilation wave (and per nuke), spawned by `spawnScorePopup` at the centroid of the cleared cells (arena pixel coords), sized/colored by combo tier, rendered by `Arena` (`.score-popup`), removed after `POPUP_MS`.
- **Screen shake** (`shake`): `{ tier: 'small' | 'big', id }` — small on bomb blasts, big on nuke; `GameScreen` applies `shake-small`/`shake-big` to `.arena-container`, cleared after `SHAKE_MS`.
- **Announcer** (`announcement`): `{ text, id, color? }` — "ALL Ns!" on 3+ wipes (glow tinted to the wiped value's tile color; multiple values join as "ALL 3s & 5s!"), "NUKE!" on nuke (default red-orange glow); rendered centered over `.arena-container` (`.announcement`), cleared after `ANNOUNCE_MS`.

---

## Zustand Store State (`src/store/`)
```ts
runId               // identifies the current game run; bumped by every initState()
grid                // ROWS×COLS number array (0 = empty)
leftPending / rightPending / topPending / bottomPending  // number[PENDING_SIZE]
score / highScore / combo
turnCount          // pushes taken this game — drives the difficulty ramp (setDifficulty)
gameOver / animating
flyingTiles         // FlyingTile descriptor array
flyingSource        // 'left'|'right'|'top'|'bottom'|null — which side is currently flying
annihilateSet       // Set<"r,c"> — cells gold-flashing (regular 2-tile annihilation)
boardWipeFlashSet   // Set<"r,c"> — cells value-colored flashing (3+ board-wide wipe)
nukeFlashSet        // Set<"r,c"> — cells red-orange flashing (nuke plus)
collapsingCells     // Set<"r,c"> — cells hidden during collapse animation
pendingCommit       // { payload, blockedIndices, pendingKey } — held during push animation
lastVerticalSide    // 'top'|'bottom'
lastHorizontalSide  // 'left'|'right'
cfg / layout / gridMode
nukeCharge          // 0..NUKE_CHARGE_MAX — accrues while unarmed, drains per push while armed
nukeArmed           // meter filled; nuke fireable (fireNuke action / Space) until meter drains to 0
turnClearedTiles / cleanSweepAwarded  // per-turn clean-sweep tracking (see Clean Sweep)
scorePopups         // ScorePopup[] — floating "+N" indicators
shake               // { tier: 'small'|'big', id } | null — screen shake trigger
announcement        // { text, id, color? } | null — "ALL Ns!" / "NUKE!" banner
soundOn             // sound toggle (persisted)
hapticsOn           // vibration toggle (persisted)
reducedMotion       // suppress decorative motion (persisted; defaults to the OS setting)
stats               // LifetimeStats — cross-run totals (persisted)
hasSavedRun         // a resumable run exists in storage (drives the menu's Continue)
```

**Run guard (`runGuard` in `store/animations.ts`):** cascades are chains of
`setTimeout`/`requestAnimationFrame` callbacks that can outlive the game that started
them — the header title navigates to the menu mid-animation, and `reset`/`setGridMode`
then install a fresh state while those timers are still pending. Each chain captures
`runId` at entry and drops every `set` once it changes, so an abandoned cascade can't
commit its grid (or, across a board switch, its **dimensions**) into the new game —
which used to leave e.g. a 9×9 grid in an 11×11 config and throw on the next push.
`triggerPush`'s deferred commit carries the same check. Any new async chain in the
store must go through `runGuard`. Regression-tested in `src/store/store.test.ts`.

**Key store helpers (in `store/animations.ts`):**
- `endTurn(grid, pendingPayload, get, set)` — runs `settleCorners`, animates both corner phases, then calls `finalize` or re-enters cascade if corner refill created matches.
- `runCollapseLoop(..., combo, chargeNuke)` — recursive cascade; accrues nuke charge, plays sounds, spawns popups/shake/announcements per wave. `chargeNuke=false` for nuke-initiated cascades.
- `nukeCenterAndSettle(...)` — nuke flash/sound/shake/announcement → clear the center plus → `runCollapseLoop` at combo MAX_COMBO with `chargeNuke=false`. Invoked only by the `fireNuke` store action.

High scores are persisted per grid mode to `localStorage` key `'tilesHighScores'` as a JSON object (`{ '7x7': number, '9x9': number, '11x11': number }`). The **selected board** is likewise persisted (`loadGridMode`/`saveGridMode`, key `'tilesGridMode'`), so a reload reopens the last-played board and `initState()` defaults to it — this is why the store's live `highScore` (surfaced on the menu / settings) always reflects the current board rather than a global best. `setGridMode` saves the mode; game-over saves the score under `get().gridMode`.

---

## Run Persistence (Continue)
A run is 100+ pushes long, so losing one to a reload or a browser-reclaimed tab
is a real cost. The pure run state (`SavedRun` in `types.ts` — grid, the four
pending strips, score, turnCount, nuke meter, last sides) is written to
localStorage key `'tilesSavedRun'` at **end of turn** (`finalize` in
`store/animations.ts`, the one quiescent point in a cascade) and again when the
tab is hidden (`hooks/useLifecycle.ts`). Animation sets, flying tiles and layout
are transient and are rebuilt on resume.

- `persistRun()` — snapshot; a no-op (and clears the slot) at turn 0 or game over.
- `resumeRun()` — `initState()` first so every transient field and the `runId`
  start clean, then the saved values are laid over it, then
  `setDifficulty(turnCount, mode)` winds the ramp back to where the run was.
  Returns `false` and leaves state untouched if there is nothing valid to load.
- `loadRun()` **validates before returning**: schema version, known board mode,
  grid dimensions matching that mode's cfg, pending strips of `PENDING_SIZE`,
  finite numeric cells, and scalar coercion. A grid whose dimensions disagree
  with its mode is exactly the state the run guard exists to prevent, so a
  mismatched save is discarded rather than loaded. Covered by
  `src/store/persistence.test.ts`.
- `reset()` and `setGridMode()` clear the save — starting a new game abandons it.
  Game over clears it too, after folding the run into lifetime stats.

The menu offers **Continue** when a run is live in memory *or* persisted; a live
run takes precedence (reloading from storage would roll back to the last settled
turn). **New Game** calls `reset()`, so it genuinely starts fresh.

## Reduced Motion
`reducedMotion` defaults to the OS `prefers-reduced-motion` query and is
overridable in Settings (persisted to `'tilesReducedMotion'`; the OS value is
tracked live only while no explicit override exists). `App.tsx` mirrors it onto
`document.documentElement.dataset.reducedMotion`, and CSS keys off that
attribute rather than the media query so the override works in both directions.

It suppresses **decorative** motion only: screen shake (dropped at the source in
`triggerShake`), the nuke-meter pulse, the combo badge pop, and the popup /
announcement / game-over animations (which cross-fade in place instead). Tile
flight and collapse motion are deliberately untouched — they are how the player
reads the board, and the cascade's `setTimeout` chain is timed against `ANIM_MS`,
so suppressing them would desynchronise animation from state commits. Rationale
lives in `src/motion.ts`.

## Haptics (`src/haptics.ts`)
Progressive enhancement over the Vibration API — Android Chrome/Firefox only;
iOS Safari exposes no such API, so every call is a no-op there and the Settings
row hides itself (`hapticsSupported()`). Call sites mirror the sound ones:
`hapticPush`, `hapticMatch(combo)`, `hapticBoardWipe`, `hapticNuke`,
`hapticCleanSweep`, `hapticGameOver`. Persisted to `'tilesHapticsOn'`.
**The RN port swaps this module's body for expo-haptics and keeps the call sites.**

## Lifetime Stats
`LifetimeStats` (gamesPlayed, totalScore, totalTurns, longestRun, bestCombo,
tilesCleared, boardWipes, nukesFired, cleanSweeps) accumulates across runs
**per board** (`StatsByBoard = Record<GridMode, LifetimeStats>`) in localStorage
key `'tilesLifetimeStatsByBoard'`. Pooling boards produced averages that described
none of them — a 7×7 run is longer but scores less than an 11×11 one. The old
pooled `'tilesLifetimeStats'` key carried no board information and is deliberately
**not** migrated (crediting it to one board would invent history); it is left in
place rather than deleted. The Stats screen shows one board at a time, opening on
the one being played. Helpers in `store/stats.ts`:
`bumpStats` (in-memory increment), `raiseStat` (best-ever), `flushStats` (write),
`recordRunEnd` (fold a finished run in and flush). Counters are bumped during
play but **flushed only at end of turn / game over / tab hide**, so a long
cascade doesn't thrash localStorage mid-animation. Surfaced on the Stats screen
alongside per-board bests.

## Fast-forward (leaving mid-cascade)
Walking off the game screen while a cascade is running must not leave it
animating, sounding and buzzing behind the menu. `setGameVisible(false)` (called
from `GameScreen`'s unmount effect) flips `setInstantSettle` in
`store/animations.ts`, which collapses every animation delay to 0 and suppresses
all juice — sound, haptics, shake, popups, announcements. Scoring, stats and the
run snapshot still happen in full, so the player keeps everything they earned and
Continue returns them to a fully settled board.

This deliberately re-runs the **same** chain rather than adding a second
synchronous settle path: duplicating the cascade rules would drift from the
animated one. Timers already scheduled keep their original delay, so one in-flight
step can still land before the flag takes effect; everything after it is silent.

## Blocked pushes are free
A swipe into a side whose every pending tile is blocked changes nothing, so it
costs nothing — no turn, no ramp advance, no nuke drain, no sound or haptic
(`canPushFrom` in `store/index.ts`). It used to consume a turn, which also
advanced the turn-based difficulty ramp for free. The branch still calls
`checkGameOver` first: a dead board must show the game-over screen rather than
silently swallow the swipe.

## Page Lifecycle (`src/hooks/useLifecycle.ts`)
Mounted once at the app root (so a run is protected on every screen). On
`visibilitychange → hidden` it snapshots the run and calls `suspendAudio()`;
`pagehide` covers reload/close (`beforeunload` is deliberately avoided — it is
unreliable on iOS and blocks the bfcache). This is the browser counterpart of
the `AppState` handling the RN port still needs.

---

## Screen Navigation (`src/App.tsx`)
Simple `useState('menu')` router, with the active screen wrapped in `ErrorBoundary` —
a render-time throw shows a recoverable crash screen ("Back to Menu" resets the store and
returns to the menu) instead of a blank page. Note it cannot catch throws from
`setTimeout`/`rAF` callbacks, which is where the cascade runs. Screens: `'menu'` → `'game'` | `'boards'` | `'howToPlay'` | `'settings'` | `'stats'`. Each screen receives `navigate` prop. The **Boards** screen (`BoardsScreen.tsx`) lists 7×7 / 9×9 / 11×11 (with per-board best scores via `loadHighScores()`); picking one calls `setGridMode(mode)` then `navigate('game')`. The "UNTILED" title in `GameHeader` is also clickable and navigates back to menu.

## Combo Strip
A 40 px flex strip sits between `GameHeader` and the arena in `GameScreen`. It is always present (prevents layout shift) and holds three zones: the NUKE charge button (left), the combo badge slot (center), and an invisible spacer (`.combo-strip-spacer`, right) that counterweights the NUKE button so the badge stays centered. When `combo >= 2` the center renders an animated `×N` badge (CSS class `combo-strip-badge`) using `COMBO_COLORS` (8-step ramp, grey→yellow→orange→red-orange→red→magenta→purple→white-hot, one per combo level). `key={combo}` on the badge triggers a fresh scale-pop animation on each increment. The strip height is included in `HEADER_H` so `useScale` accounts for it.

## Source Layout
```
src/
  game/           ← pure game logic (no React, no browser APIs)
    config.ts     — GRID_CONFIGS, DEFAULT_CFG, top-level ROWS/COLS constants
    tiles.ts      — spawn weights + difficulty ramp (rampedSpawn/setDifficulty,
                    DEFAULT_SPAWN_WEIGHTS/setSpawnWeights, randTileSide*), specialty-tile
                    flags, getTileColor + palettes, createInitialPending
    grid.ts       — createInitialGrid, isPlayAreaEmpty
    corners.ts    — isCornerCell, getCornerBlockSpecs, settleCorners
    push.ts       — pushFromLeft/Right/Top/Bottom, checkGameOver
    collapse.ts   — collapseGrid (single-axis staged passes; no diagonal moves)
    annihilate.ts — annihilateAdjacent
    combo.ts      — MAX_COMBO, NUKE_CHARGE_MAX, NUKE_DECAY_PER_PUSH,
                    CLEAN_SWEEP_BONUS_PER_TILE, nextCombo, nukePlusCells, nukeCrossScore
    index.ts      — re-exports all of the above
    gameLogic.test.ts — pure logic tests (see Testing)
  store/          ← Zustand store, split by concern
    persistence.ts — localStorage: high scores, prefs, saved run, lifetime stats
    init.ts       — initState (fresh game state + a new runId)
    animations.ts — endTurn, runCollapseLoop, nukeCenterAndSettle
    stats.ts      — bumpStats / raiseStat / flushStats / recordRunEnd
    index.ts      — useGameStore (triggerPush + store creation)
    persistence.test.ts — saved-run validation + stats round-trip (see Testing)
  components/     ← React components
  hooks/          ← useInput, useScale, useLifecycle
  types.ts        — all shared TypeScript types
  constants.ts    — CELL, GAP, animation/juice timings, COMBO_COLORS
  sound.ts        — synthesized WebAudio SFX (see Juice section) + suspendAudio
  haptics.ts      — Vibration API wrapper (see Haptics)
  motion.ts       — prefers-reduced-motion query + subscription (see Reduced Motion)
  layout.ts       — getLayout, cellPos, *PendingPos helpers
docs/
  balance.md    — difficulty/spawn tuning rationale + per-board numbers (see Difficulty ramp)
scripts/
  simulate.ts     — headless balance simulator (`npm run sim -- boards|ramp|vcount|dist|abilities [games]`);
                    plays full games with the real game logic under three bots:
                    random, greedy (1-ply), planner (2-ply lookahead + survival). `ramp`
                    (default) models the shipped 9×9 difficulty ramp; `boards` runs all
                    three sizes side-by-side under their per-board ramps; `vcount <board>`
                    sweeps a board's turn-0 value count; `dist` is a static, non-ramped
                    spawn-distribution sweep (endpoint tuning); `abilities` sweeps nuke
                    tuning. Use it to tune spawn/ramp/ability/per-size changes.
```

## Components
| File | Role |
|------|------|
| `Arena.tsx` | Grid (+ 4 corner obstacle-zone frames) + 4 pending strips + flying tiles + score popups; reads `annihilateSet`, `boardWipeFlashSet`, `nukeFlashSet` to drive flash props on Tile |
| `Tile.tsx` | Single tile div; props: `value`, `size`, `flashAnnihilate`, `flashBoardWipe`, `flashBomb`, `flashNuke`, `centerColumn` |
| `FlyingTile.tsx` | Animated flying tile (CSS transition via double-rAF) |
| `ErrorBoundary.tsx` | Class boundary around the active screen; renders the crash screen (`.crash-box`) with a reset back to the menu |
| `GameScreen.tsx` | Computes `scale` via `useScale`, mounts `useInput`, renders header + combo strip (nuke/combo/spacer) + arena; applies shake class and announcement overlay |
| `GameHeader.tsx` | Score / highScore display; title is clickable (navigates to menu via `onMenu` prop) |
| `GameOverOverlay.tsx` | Overlay with Play Again + Main Menu |
| `MenuScreen.tsx` | Title "UNTILED" + decorative mini-tile row + Continue (when a run is resumable) / Play·New Game / Boards / How to Play / Stats / Settings buttons + best-score badge |
| `BoardsScreen.tsx` | Board-size picker (7×7 / 9×9 / 11×11) with per-board best scores; selecting one sets `gridMode` and starts a game |
| `HowToPlayScreen.tsx` | Rule cards (icon + text + mini `Tile` examples) covering push, annihilation, combos, nuke, clean sweep, bombs/stones, corners, game over (copy is author-written — edit the `sections` array at the top of the file) |
| `SettingsScreen.tsx` | Card-based: sound / haptics / reduce-motion toggles, Tile Colors palette, high score + reset, and About (privacy policy + support links — kept in step with mobile, where they are an App Review requirement). Board size lives in the Boards screen; a dead grid-size selector that could never render was removed Sept 2026. The haptics row hides itself where the browser has no Vibration API |
| `StatsScreen.tsx` | Per-board best scores + lifetime totals (see Lifetime Stats), with a reset that clears totals but keeps bests |

## Hooks
- `useInput(triggerPush, fireNuke?)` — keyboard (ArrowKeys push, Space fires nuke) + touch (touchstart/touchend, 30px threshold)
- `useScale(containerW, containerH)` — responsive scale factor; listens to ResizeObserver + visualViewport + orientationchange; sets `--app-h` CSS var; clamps to [0.28, 1]

## Layout (`src/layout.ts`)
`getLayout(cfg)` → layout object with pixel positions for the container, grid, and all four pending strips. Helper fns: `cellPos`, `leftPendingPos`, `rightPendingPos`, `topPendingPos`, `bottomPendingPos`.

## Tile Colors (`getTileColor` in `src/game/tiles.ts`)
1→blue, 2→teal, 3→green, 4→yellow-green, 5→yellow, 6→orange, 7→red-orange, 8→red, 9→magenta, 10→purple. Values > 10 fall back to white/dark.

---

## Testing
`src/game/gameLogic.test.ts` — pure logic tests (no React).
`src/store/persistence.test.ts` — saved-run validation (every way a save can be
malformed must be rejected, not loaded — a grid whose dimensions disagree with
its mode is the crash the run guard exists to prevent) plus lifetime-stats
round-tripping. Shims `localStorage`/`matchMedia` since the jest environment is
node. `src/store/store.test.ts` —
store-level tests that drive the real animation chains (shims `requestAnimationFrame`
onto `setTimeout` and waits in real time; a few seconds per case), covering the run
guard: switching boards or resetting mid-cascade must leave a consistent, playable
board. Run both with `npm test`.  
Covers: constants, grid init, push from all 4 sides, gravity/horizontal collapse, annihilation (including board-wide wipe: 3+ connected group triggers full-value sweep; 2-tile groups remain local), game-over detection, nuke plus score, combo math, and regression tests for collapse animation integrity (same-value tiles in the same pass must never be chained; an obstacle-blocked tile turns the corner across straight single-axis stages, never a diagonal).

---

## Mobile Port
Expo port at `/Users/evanczako/Documents/Code-ish/Tile Games/Tiles2-Mobile`.  
Stack: Expo SDK 54, React Native 0.81, Reanimated v4, Gesture Handler v2, AsyncStorage, Zustand 5.  
Run: `cd Tiles2-Mobile && npx expo start`
