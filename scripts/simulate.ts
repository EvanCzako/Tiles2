/**
 * Headless UNTILED balance simulator.
 *
 * Run with:   npm run sim -- dist          (spawn-distribution sweep)
 *             npm run sim -- abilities     (nuke/reroll tuning sweep)
 *             npm run sim -- dist 200      (optional: games per config, default 50)
 *
 * Imports the REAL game logic from src/game — no forked rules — and replicates
 * the store's turn pipeline exactly:
 *
 *   push → [collapse → annihilate]* → [settleCorners → re-cascade if matches]* → checkGameOver
 *
 * including the nuke ability state machine (accrue min(combo,5) per wave →
 * arm at NUKE_CHARGE_MAX → drain NUKE_DECAY_PER_PUSH per push while armed →
 * lost at 0), the half-meter clean-sweep refill, and the strip reroll.
 *
 * Spawn distributions are injected via setSpawnWeights() from src/game/tiles.ts,
 * so alternative tile counts/weights are tested against unmodified logic.
 * Edit DIST_CONFIGS / ABILITY_CONFIGS below to test new candidates.
 *
 * Player models (both weaker than a skilled human — treat results as bounds):
 *   random — uniform choice among available directions (button-mashing floor)
 *   greedy — 1-ply: maximizes immediate cascade score, ties broken toward the
 *            emptier resulting board; fires the nuke when the board is ≥ 50%
 *            full or the armed meter is about to expire; rerolls a random strip
 *            when nothing scores and the board is > 50% full
 *
 * Metrics per config:
 *   medTurns  — median pushes survived (capped at TURN_CAP)
 *   cap%      — share of games still alive at TURN_CAP ("effectively unloseable")
 *   avgOcc    — mean play-area fill fraction (difficulty pressure proxy)
 *   medScore  — median final score (clean-sweep score bonus NOT included)
 *   nukes/100t, medFillGap (turns to fill the meter), sweeps/game,
 *   rerolls/100t, lost/game (armed nukes that drained to 0 unfired)
 *
 * Calibration reference (July 2026, 9-value table, greedy): no abilities →
 * median ~90 turns / 0% cap; shipped nuke-only tuning (64/d2, no reroll,
 * no sweep refill) → median ~130 turns / ~0% cap — an arcade-length game
 * where deaths stay real for decent players. The greedy bot is a floor for a
 * skilled human, so treat its median as a lower bound on real run length.
 */
import {
  GRID_CONFIGS,
  createInitialGrid,
  createInitialPending,
  setSpawnWeights,
  DEFAULT_SPAWN_WEIGHTS,
  pushFromLeft,
  pushFromRight,
  pushFromTop,
  pushFromBottom,
  collapseGrid,
  annihilateAdjacent,
  settleCorners,
  checkGameOver,
  isPlayAreaEmpty,
  nukeCrossScore,
  nextCombo,
  isCornerCell,
  MAX_COMBO,
  NUKE_CHARGE_MAX,
  NUKE_DECAY_PER_PUSH,
} from '../src/game';
import type { Grid, GridCfg, VerticalSide, HorizontalSide, PushResult } from '../src/types';

const cfg: GridCfg = GRID_CONFIGS['9x9'];
const TURN_CAP = 800;

type Side = 'left' | 'right' | 'top' | 'bottom';
const SIDES: Side[] = ['left', 'right', 'top', 'bottom'];
const PUSH_FNS: Record<Side, (g: Grid, p: number[], c: GridCfg) => PushResult> = {
  left: pushFromLeft,
  right: pushFromRight,
  top: pushFromTop,
  bottom: pushFromBottom,
};

// ── Ability tuning under test (defaults = shipped values) ───────────────────
interface Abilities {
  nukeMax: number; // Infinity = nuke disabled
  nukeDecay: number; // charge lost per push while armed
  sweepRefill: number; // fraction of the meter granted on a clean sweep (0 = none, 0.5 = half)
  rerollCooldown: number; // Infinity = reroll disabled
  nukeOccThreshold: number; // greedy bot holds the nuke until board ≥ this full
}

// Shipped game (July 2026): nuke only — no strip reroll, and the clean sweep
// pays a score bonus without refilling the meter. The reroll knob is retained
// below only for exploratory sweeps (Infinity = disabled, matching shipped).
const SHIPPED: Abilities = {
  nukeMax: NUKE_CHARGE_MAX,
  nukeDecay: NUKE_DECAY_PER_PUSH,
  sweepRefill: 0,
  rerollCooldown: Infinity,
  nukeOccThreshold: 0.5,
};
const NO_ABILITIES: Abilities = {
  ...SHIPPED,
  nukeMax: Infinity,
  rerollCooldown: Infinity,
};

// ── Sim state & core turn pipeline ──────────────────────────────────────────
interface SimState {
  grid: Grid;
  pending: Record<Side, number[]>;
  vSide: VerticalSide;
  hSide: HorizontalSide;
  score: number;
  charge: number;
  armed: boolean;
  rerollCd: number;
}

function newGame(): SimState {
  return {
    grid: createInitialGrid(cfg),
    pending: {
      left: createInitialPending(cfg),
      right: createInitialPending(cfg),
      top: createInitialPending(cfg),
      bottom: createInitialPending(cfg),
    },
    vSide: 'top',
    hSide: 'left',
    score: 0,
    charge: 0,
    armed: false,
    rerollCd: 0,
  };
}

function cascade(grid: Grid, vSide: VerticalSide, hSide: HorizontalSide, startCombo = 1) {
  let combo = startCombo,
    score = 0,
    chargeGain = 0,
    cleared = 0,
    wipes = 0;
  for (;;) {
    grid = collapseGrid(grid, cfg, vSide, hSide).grid;
    const ann = annihilateAdjacent(grid, cfg);
    if (ann.annihilatedCells.length === 0) return { grid, score, chargeGain, cleared, wipes };
    const mult = Math.min(combo, MAX_COMBO);
    score += ann.score * mult;
    chargeGain += mult;
    cleared += ann.annihilatedCells.length - ann.unlockedCells.length;
    wipes += ann.boardWipeValues.length;
    combo = nextCombo(combo);
    grid = ann.grid;
  }
}

function gainCharge(st: SimState, ab: Abilities, amount: number): void {
  if (st.armed || !Number.isFinite(ab.nukeMax)) return;
  st.charge = Math.min(ab.nukeMax, st.charge + amount);
  if (st.charge >= ab.nukeMax) st.armed = true;
}

// Corner settlement + possible re-cascade (endTurn semantics). Corner
// re-cascades accrue charge on normal turns but not on nuke fallout.
function settleLoop(st: SimState, grid: Grid, ab: Abilities, chargeNuke: boolean): Grid {
  for (let guard = 0; guard < 50; guard++) {
    grid = settleCorners(grid, cfg).grid;
    const ann = annihilateAdjacent(grid, cfg);
    if (ann.annihilatedCells.length === 0) break;
    const c = cascade(grid, st.vSide, st.hSide);
    grid = c.grid;
    st.score += c.score;
    if (chargeNuke) gainCharge(st, ab, c.chargeGain);
  }
  return grid;
}

function occupancy(grid: Grid): number {
  let filled = 0,
    total = 0;
  for (let r = 0; r < cfg.ROWS; r++) {
    for (let c = 0; c < cfg.COLS; c++) {
      if (isCornerCell(r, c, cfg)) continue;
      total++;
      if (grid[r][c] !== 0) filled++;
    }
  }
  return filled / total;
}

function availableSides(grid: Grid): Side[] {
  const dummy = Array(cfg.PENDING_SIZE).fill(1) as number[];
  return SIDES.filter((s) => PUSH_FNS[s](grid, dummy, cfg).landings.some((l) => !l.flyThrough));
}

// ── Player policies ─────────────────────────────────────────────────────────
type Policy = (st: SimState, sides: Side[]) => { side: Side; bestScore: number };

const randomPolicy: Policy = (_st, sides) => ({
  side: sides[Math.floor(Math.random() * sides.length)],
  bestScore: NaN, // random bot never rerolls
});

const greedyPolicy: Policy = (st, sides) => {
  let best: Side = sides[0],
    bestScore = -Infinity,
    bestOcc = Infinity;
  for (const s of sides) {
    const res = PUSH_FNS[s](
      st.grid.map((r) => [...r]),
      st.pending[s],
      cfg
    );
    const c = cascade(res.grid, st.vSide, st.hSide);
    const occ = occupancy(c.grid);
    if (c.score > bestScore || (c.score === bestScore && occ < bestOcc)) {
      bestScore = c.score;
      bestOcc = occ;
      best = s;
    }
  }
  return { side: best, bestScore };
};

// ── One full game ───────────────────────────────────────────────────────────
interface GameResult {
  turns: number;
  score: number;
  avgOcc: number;
  capped: boolean;
  nukes: number;
  fillGaps: number[];
  sweeps: number;
  rerolls: number;
  lostNukes: number;
}

function playGame(policy: Policy, ab: Abilities): GameResult {
  const st = newGame();
  let occSum = 0,
    turns = 0,
    nukes = 0,
    sweeps = 0,
    rerolls = 0,
    lostNukes = 0,
    lastFillTurn = 0;
  const fillGaps: number[] = [];

  for (; turns < TURN_CAP; turns++) {
    // Fire the nuke under pressure, or just before the armed meter expires
    if (
      st.armed &&
      (occupancy(st.grid) >= ab.nukeOccThreshold ||
        (ab.nukeDecay > 0 && st.charge <= ab.nukeDecay))
    ) {
      nukes++;
      st.charge = 0;
      st.armed = false;
      lastFillTurn = turns;
      const { cells, score } = nukeCrossScore(st.grid, cfg);
      st.score += score * MAX_COMBO;
      const g = st.grid.map((r) => [...r]);
      for (const [r, c] of cells) g[r][c] = 0;
      const c = cascade(g, st.vSide, st.hSide, MAX_COMBO);
      st.score += c.score; // nuke fallout never recharges the meter
      st.grid = settleLoop(st, c.grid, ab, false);
      if (checkGameOver(st.grid, cfg)) {
        turns++;
        break;
      }
    }

    const sides = availableSides(st.grid);
    if (sides.length === 0) break;
    const { side, bestScore } = policy(st, sides);

    // Reroll when nothing scores and the board is under pressure
    if (
      bestScore <= 0 &&
      st.rerollCd <= 0 &&
      Number.isFinite(ab.rerollCooldown) &&
      occupancy(st.grid) > 0.5
    ) {
      rerolls++;
      st.rerollCd = ab.rerollCooldown;
      st.pending[sides[Math.floor(Math.random() * sides.length)]] = createInitialPending(cfg);
      continue; // a reroll is not a push
    }

    // Push (armed meter drains per push; fully drained = nuke lost)
    st.rerollCd = Math.max(0, st.rerollCd - 1);
    const preArmed = st.armed;
    if (st.armed) {
      st.charge -= ab.nukeDecay;
      if (st.charge <= 0) {
        st.charge = 0;
        st.armed = false;
        lostNukes++;
      }
    }
    const res = PUSH_FNS[side](st.grid, st.pending[side], cfg);
    st.pending[side] = res.pending;
    if (side === 'top') st.vSide = 'top';
    if (side === 'bottom') st.vSide = 'bottom';
    if (side === 'left') st.hSide = 'left';
    if (side === 'right') st.hSide = 'right';

    const c = cascade(res.grid, st.vSide, st.hSide);
    st.score += c.score;
    gainCharge(st, ab, c.chargeGain);

    // Clean sweep: half (or full) meter refill; score bonus not modeled
    let grid = c.grid;
    if (c.cleared > 0 && isPlayAreaEmpty(grid, cfg)) {
      sweeps++;
      if (ab.sweepRefill > 0) gainCharge(st, ab, ab.nukeMax * ab.sweepRefill);
    }
    st.grid = settleLoop(st, grid, ab, true);

    if (!preArmed && st.armed) {
      fillGaps.push(turns - lastFillTurn);
      lastFillTurn = turns;
    }

    occSum += occupancy(st.grid);
    if (checkGameOver(st.grid, cfg)) {
      turns++;
      break;
    }
  }
  return {
    turns,
    score: st.score,
    avgOcc: turns ? occSum / turns : 0,
    capped: turns >= TURN_CAP,
    nukes,
    fillGaps,
    sweeps,
    rerolls,
    lostNukes,
  };
}

// ── Reporting ───────────────────────────────────────────────────────────────
function pct(x: number): string {
  return (100 * x).toFixed(1) + '%';
}
function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function runConfig(name: string, policy: Policy, ab: Abilities, games: number): void {
  const rs: GameResult[] = [];
  for (let i = 0; i < games; i++) rs.push(playGame(policy, ab));
  const totalTurns = rs.reduce((a, r) => a + r.turns, 0);
  console.log(
    name.padEnd(36) +
      String(median(rs.map((r) => r.turns))).padEnd(10) +
      pct(rs.filter((r) => r.capped).length / rs.length).padEnd(8) +
      pct(rs.reduce((a, r) => a + r.avgOcc, 0) / rs.length).padEnd(8) +
      String(median(rs.map((r) => r.score))).padEnd(10) +
      ((100 * rs.reduce((a, r) => a + r.nukes, 0)) / totalTurns).toFixed(1).padEnd(8) +
      String(median(rs.flatMap((r) => r.fillGaps))).padEnd(9) +
      (rs.reduce((a, r) => a + r.sweeps, 0) / rs.length).toFixed(2).padEnd(9) +
      ((100 * rs.reduce((a, r) => a + r.rerolls, 0)) / totalTurns).toFixed(1).padEnd(8) +
      (rs.reduce((a, r) => a + r.lostNukes, 0) / rs.length).toFixed(2)
  );
}

const HEADER =
  'config'.padEnd(36) +
  'medTurns  cap%    avgOcc  medScore  nk/100t  fillGap  swp/game rr/100t  lost/game';

// ── Sweeps (edit these to test new candidates) ──────────────────────────────
const DIST_CONFIGS: { name: string; weights: number[] }[] = [
  { name: 'shipped 9 [19,16,14,12,10,9,8,7,6]', weights: [...DEFAULT_SPAWN_WEIGHTS] },
  { name: 'previous 8 [19,17,15,13,11,10,8,7]', weights: [19, 17, 15, 13, 11, 10, 8, 7] },
  { name: 'previous 7 [22,19,16,14,12,10,7]', weights: [22, 19, 16, 14, 12, 10, 7] },
  { name: 'flat7', weights: [1, 1, 1, 1, 1, 1, 1] },
  { name: 'flat8', weights: [1, 1, 1, 1, 1, 1, 1, 1] },
  { name: 'flat9', weights: [1, 1, 1, 1, 1, 1, 1, 1, 1] },
];

// Default sweep: the shipped nuke-only tuning against the no-ability floor,
// plus a couple of reference points. Edit freely to explore new candidates.
const ABILITY_CONFIGS: { name: string; ab: Abilities }[] = [
  { name: 'no abilities (floor)', ab: NO_ABILITIES },
  { name: 'shipped (nuke 64/d2, no reroll)', ab: SHIPPED },
  { name: 'old (nuke 24/d1, sweep .5, reroll 10)', ab: { ...SHIPPED, nukeMax: 24, nukeDecay: 1, sweepRefill: 0.5, rerollCooldown: 10 } },
  { name: 'shipped + reroll 10', ab: { ...SHIPPED, rerollCooldown: 10 } },
];

const mode = process.argv[2] ?? 'abilities';
const games = Number(process.argv[3] ?? 50);

if (mode === 'dist') {
  for (const policy of [
    { name: 'random', fn: randomPolicy },
    { name: 'greedy', fn: greedyPolicy },
  ]) {
    console.log(`\n=== spawn distributions — ${policy.name} policy, shipped abilities, ${games} games ===`);
    console.log(HEADER);
    for (const d of DIST_CONFIGS) {
      setSpawnWeights(d.weights);
      runConfig(d.name, policy.fn, SHIPPED, games);
    }
    setSpawnWeights([...DEFAULT_SPAWN_WEIGHTS]);
  }
} else if (mode === 'abilities') {
  console.log(`\n=== ability tuning — greedy policy, shipped spawn table, ${games} games ===`);
  console.log(HEADER);
  for (const c of ABILITY_CONFIGS) runConfig(c.name, greedyPolicy, c.ab, games);
} else {
  console.error(`Unknown mode "${mode}" — use "dist" or "abilities".`);
  process.exit(1);
}
