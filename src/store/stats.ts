import type { GameStore, LifetimeStats } from '../types';
import { saveStats } from './persistence';

type ZustandGet = () => GameStore;
type ZustandSet = (partial: Partial<GameStore>) => void;

// All counters are scoped to the board the run is being played on: a 7x7 run is
// longer but scores less than an 11x11 one, so pooling them yields averages that
// describe no board in particular.

/**
 * Accumulate lifetime counters for the current board, in memory. Deliberately
 * *not* persisted per call: a long cascade bumps these several times a turn, and
 * the run itself is only durable at end of turn / on tab hide anyway, so stats
 * are flushed at exactly those points (see flushStats) rather than thrashing
 * localStorage mid-animation.
 */
export function bumpStats(get: ZustandGet, set: ZustandSet, patch: Partial<LifetimeStats>): void {
  const { stats, gridMode } = get();
  const cur = stats[gridMode];
  const next = { ...cur };
  for (const k of Object.keys(patch) as (keyof LifetimeStats)[]) {
    const delta = patch[k];
    if (typeof delta === 'number') next[k] = cur[k] + delta;
  }
  set({ stats: { ...stats, [gridMode]: next } });
}

/** Raise a "best ever" counter for the current board, ignoring non-improvements. */
export function raiseStat(
  get: ZustandGet,
  set: ZustandSet,
  key: 'longestRun' | 'bestCombo',
  value: number
): void {
  const { stats, gridMode } = get();
  const cur = stats[gridMode];
  if (value <= cur[key]) return;
  set({ stats: { ...stats, [gridMode]: { ...cur, [key]: value } } });
}

export function flushStats(get: ZustandGet): void {
  saveStats(get().stats);
}

/** Fold a finished run into its board's lifetime totals and persist them. */
export function recordRunEnd(get: ZustandGet, set: ZustandSet): void {
  const { score, turnCount } = get();
  bumpStats(get, set, { gamesPlayed: 1, totalScore: score, totalTurns: turnCount });
  raiseStat(get, set, 'longestRun', turnCount);
  flushStats(get);
}
