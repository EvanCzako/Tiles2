# Difficulty & balance

Design rationale and tuned numbers for UNTILED's spawn/difficulty system. Split out of
CLAUDE.md so the always-loaded project context stays operational; this is the reference
to read (and update) when changing difficulty, adding a board size, or interpreting a
simulator run.

The knobs themselves live at the top of the ramp block in `src/game/tiles.ts`. Retune with
`npm run sim -- boards` (see `scripts/simulate.ts` for the other modes: `ramp`, `vcount`,
`dist`, `abilities`).

### Difficulty ramp (`rampedSpawn`/`setDifficulty` in `game/tiles.ts`)
Spawn odds evolve with **turns survived** (`turnCount`), because survival is governed by *match scarcity* — two same-value tiles must land adjacent to clear. The ramp is also **per-board**: both the store (before each push, in `triggerPush`) and the simulator (per turn) call `setDifficulty(turn, gridMode)`, so each board follows its own tuned curve. `rampedSpawn(turn, board)` returns `{ weights, bomb, stone, locked }`:
- **Value weights (the primary per-board lever):** each board starts at a near-flat `easy` table of `BOARD_VALUE_COUNTS[board]` values and flattens toward a uniform `hard` table, with one extra value fading in mid-run (`TENTH_*`) up to the `MAX_VALUES = 10` color ceiling. **9×9 = 9 values** (byte-identical to the shipped `[13,12,12,11,11,10,10,9,9]` → 10th fades in). Match scarcity depends on *both* value count and board area, so a smaller board (fills faster, less room) needs **fewer** values to survive as long: **7×7 = 7**, **11×11 = 10** (pinned at the ceiling). Fewer values → neighbours share a value more often → more matches. `makeBoardRamp(n)` builds each table (9 special-cased to the exact literal).
- **Stones ramp up** (`STONE_CHANCE` 3% → `STONE_MAX` 22%) — the *unbounded* clutter lever (stones can't be repositioned into a match, so they pile up); this is what caps runaway games. `BOARD_STONE_SCALE[board]` multiplies the slope: **11×11 = 3.0** (the roomy board is pinned at the 10-value ceiling yet still outlives 9×9 for skilled play, so its stones reach the shared `STONE_MAX` by ~turn 190 — the shared cap means no board exceeds 9×9's peak stone density). 7×7/9×9 = 1.0. **Bomb stays flat**; **locked** fades in late.
- **Balance:** sim-tuned (`npm run sim -- boards`) so the 2-ply "planner" bot's median survival matches across sizes (~206/206/212 turns for 7×7/9×9/11×11) and random-mashing is tight (~66/68/70); mid-skill (greedy) is a bit more forgiving on the non-default boards, an unavoidable artifact of the coarse integer value-count lever (each step ≈2× survival). Knobs (`RAMP_GRACE/FULL`, `TENTH_*`, `MAX_VALUES`, `STONE_*`, `LOCKED_*`, `BOARD_VALUE_COUNTS`, `BOARD_STONE_SCALE`) live at the top of the ramp block. `DEFAULT_SPAWN_WEIGHTS` is now only a static reference for the simulator's non-ramped `dist` sweep.

## Adding a board size

`GRID_CONFIGS` (`src/game/config.ts`), `BOARD_VALUE_COUNTS` and `BOARD_STONE_SCALE`
(`src/game/tiles.ts`) are all keyed by `GridMode`, so a new board fails to compile until
it has a config *and* a tuned value count and stone scale — it can't silently inherit
9×9's curve. Pick the value count with `npm run sim -- vcount <board>`, then check it
against the other sizes with `npm run sim -- boards`.
