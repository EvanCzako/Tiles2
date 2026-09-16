import type { GameStore, LifetimeStats } from '../types';
import { saveStats } from './persistence';

type ZustandGet = () => GameStore;
type ZustandSet = (partial: Partial<GameStore>) => void;

/**
 * Accumulate lifetime counters in memory. Deliberately *not* persisted per call:
 * a long cascade bumps these several times a turn, and the run itself is only
 * durable at end of turn / on tab hide anyway, so stats are flushed at exactly
 * those points (see flushStats) rather than thrashing localStorage mid-animation.
 */
export function bumpStats(get: ZustandGet, set: ZustandSet, patch: Partial<LifetimeStats>): void {
  const cur = get().stats;
  const next = { ...cur };
  for (const k of Object.keys(patch) as (keyof LifetimeStats)[]) {
    const delta = patch[k];
    if (typeof delta === 'number') next[k] = cur[k] + delta;
  }
  set({ stats: next });
}

/** Raise a "best ever" counter, ignoring anything that isn't an improvement. */
export function raiseStat(
  get: ZustandGet,
  set: ZustandSet,
  key: 'longestRun' | 'bestCombo',
  value: number
): void {
  const cur = get().stats;
  if (value <= cur[key]) return;
  set({ stats: { ...cur, [key]: value } });
}

export function flushStats(get: ZustandGet): void {
  saveStats(get().stats);
}

/** Fold a finished run into the lifetime totals and persist them. */
export function recordRunEnd(get: ZustandGet, set: ZustandSet): void {
  const { score, turnCount } = get();
  bumpStats(get, set, { gamesPlayed: 1, totalScore: score, totalTurns: turnCount });
  raiseStat(get, set, 'longestRun', turnCount);
  flushStats(get);
}
