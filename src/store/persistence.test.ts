// Saved-run validation tests.
//
// A resumed run writes a grid straight into the store, so an inconsistent save
// is the same hazard the run guard exists to prevent: a grid whose dimensions
// disagree with its board config throws on the next push. These assert that
// every way a save can be wrong is rejected rather than loaded.
//
// The jest environment is node, so localStorage is shimmed here — persistence.ts
// guards on `typeof window`, and without a window it degrades to a no-op.
class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.has(k) ? (this.data.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, String(v));
  }
  removeItem(k: string): void {
    this.data.delete(k);
  }
  clear(): void {
    this.data.clear();
  }
}

const storage = new MemoryStorage();
(globalThis as { window?: unknown }).window = globalThis;
(globalThis as { localStorage?: unknown }).localStorage = storage;
(globalThis as { matchMedia?: unknown }).matchMedia = () => ({
  matches: false,
  addEventListener: () => {},
  removeEventListener: () => {},
});

import {
  saveRun, loadRun, clearRun,
  loadStats, saveStats, resetStats, EMPTY_STATS, emptyStatsByBoard,
} from './persistence';
import { GRID_CONFIGS } from '../game';
import type { SavedRun, GridMode } from '../types';

function makeRun(mode: GridMode = '9x9'): SavedRun {
  const cfg = GRID_CONFIGS[mode];
  const pending = () => Array<number>(cfg.PENDING_SIZE).fill(3);
  return {
    gridMode: mode,
    grid: Array.from({ length: cfg.ROWS }, () => Array<number>(cfg.COLS).fill(1)),
    leftPending: pending(),
    rightPending: pending(),
    topPending: pending(),
    bottomPending: pending(),
    score: 4200,
    turnCount: 37,
    nukeCharge: 18,
    nukeArmed: false,
    lastVerticalSide: 'bottom',
    lastHorizontalSide: 'right',
  };
}

// Corrupt one field of an otherwise-valid persisted run and read it back.
function loadWithPatch(patch: Record<string, unknown>): SavedRun | null {
  saveRun(makeRun());
  const raw = JSON.parse(storage.getItem('tilesSavedRun') as string) as Record<string, unknown>;
  storage.setItem('tilesSavedRun', JSON.stringify({ ...raw, ...patch }));
  return loadRun();
}

beforeEach(() => storage.clear());

describe('saved run round-trip', () => {
  test('a valid run survives save → load intact', () => {
    const run = makeRun();
    saveRun(run);
    expect(loadRun()).toEqual(run);
  });

  test('every board size round-trips at its own dimensions', () => {
    for (const mode of Object.keys(GRID_CONFIGS) as GridMode[]) {
      storage.clear();
      const run = makeRun(mode);
      saveRun(run);
      const loaded = loadRun();
      expect(loaded).not.toBeNull();
      expect(loaded?.gridMode).toBe(mode);
      expect(loaded?.grid.length).toBe(GRID_CONFIGS[mode].ROWS);
      expect(loaded?.leftPending.length).toBe(GRID_CONFIGS[mode].PENDING_SIZE);
    }
  });

  test('no save reads back as null', () => {
    expect(loadRun()).toBeNull();
  });

  test('clearRun removes the save', () => {
    saveRun(makeRun());
    clearRun();
    expect(loadRun()).toBeNull();
  });
});

describe('saved run validation', () => {
  test('rejects a grid whose dimensions disagree with its mode', () => {
    // The exact shape that used to crash the next push: 9x9 data, 11x11 config.
    const nineByNine = makeRun('9x9');
    expect(loadWithPatch({ gridMode: '11x11', grid: nineByNine.grid })).toBeNull();
  });

  test('rejects a truncated grid', () => {
    expect(loadWithPatch({ grid: makeRun().grid.slice(0, 5) })).toBeNull();
  });

  test('rejects a ragged grid row', () => {
    const grid = makeRun().grid.map((r) => [...r]);
    grid[3] = grid[3].slice(0, 4);
    expect(loadWithPatch({ grid })).toBeNull();
  });

  test('rejects non-numeric cells', () => {
    const grid = makeRun().grid.map((r) => [...r]) as unknown[][];
    grid[0][0] = 'x';
    expect(loadWithPatch({ grid })).toBeNull();
  });

  test('rejects a pending strip of the wrong length', () => {
    expect(loadWithPatch({ topPending: [1, 2] })).toBeNull();
  });

  test('rejects an unknown board mode', () => {
    expect(loadWithPatch({ gridMode: '13x13' })).toBeNull();
  });

  test('rejects a save written by a different schema version', () => {
    expect(loadWithPatch({ version: 99 })).toBeNull();
  });

  test('rejects unparseable JSON', () => {
    storage.setItem('tilesSavedRun', '{not json');
    expect(loadRun()).toBeNull();
  });

  test('coerces out-of-range scalars rather than trusting them', () => {
    const loaded = loadWithPatch({ score: -50, turnCount: 'many', nukeCharge: NaN, nukeArmed: 'yes' });
    expect(loaded?.score).toBe(0);
    expect(loaded?.turnCount).toBe(0);
    expect(loaded?.nukeCharge).toBe(0);
    // Only a real boolean true arms the meter — a truthy string must not.
    expect(loaded?.nukeArmed).toBe(false);
  });

  test('falls back to a known side when the stored side is garbage', () => {
    const loaded = loadWithPatch({ lastVerticalSide: 'sideways', lastHorizontalSide: null });
    expect(loaded?.lastVerticalSide).toBe('top');
    expect(loaded?.lastHorizontalSide).toBe('left');
  });
});

describe('lifetime stats (per board)', () => {
  test('absent stats read back as a zeroed record for every board', () => {
    const loaded = loadStats();
    for (const mode of Object.keys(GRID_CONFIGS) as GridMode[]) {
      expect(loaded[mode]).toEqual(EMPTY_STATS);
    }
  });

  test('per-board stats round-trip independently', () => {
    const stats = emptyStatsByBoard();
    stats['7x7'] = { ...EMPTY_STATS, gamesPlayed: 4, totalScore: 1200, longestRun: 210 };
    stats['11x11'] = { ...EMPTY_STATS, gamesPlayed: 9, totalScore: 98765, bestCombo: 8 };
    saveStats(stats);
    const loaded = loadStats();
    expect(loaded['7x7'].gamesPlayed).toBe(4);
    expect(loaded['11x11'].totalScore).toBe(98765);
    // The board that was never played stays zeroed rather than inheriting.
    expect(loaded['9x9']).toEqual(EMPTY_STATS);
  });

  test('a board missing from stored data reads back zeroed', () => {
    storage.setItem('tilesLifetimeStatsByBoard', JSON.stringify({ '9x9': { gamesPlayed: 3 } }));
    const loaded = loadStats();
    expect(loaded['9x9'].gamesPlayed).toBe(3);
    expect(loaded['7x7']).toEqual(EMPTY_STATS);
    expect(loaded['11x11']).toEqual(EMPTY_STATS);
  });

  test('negative, non-numeric and missing counters fall back to zero', () => {
    storage.setItem(
      'tilesLifetimeStatsByBoard',
      JSON.stringify({ '9x9': { gamesPlayed: -3, totalScore: 'lots', bestCombo: 5 } })
    );
    const s = loadStats()['9x9'];
    expect(s.gamesPlayed).toBe(0);
    expect(s.totalScore).toBe(0);
    expect(s.bestCombo).toBe(5);
    expect(s.nukesFired).toBe(0);
  });

  test('the old pooled key is ignored, not misattributed to a board', () => {
    // It held no board information, so silently crediting it to 9x9 would invent
    // history that never happened.
    storage.setItem('tilesLifetimeStats', JSON.stringify({ gamesPlayed: 42, totalScore: 99999 }));
    const loaded = loadStats();
    for (const mode of Object.keys(GRID_CONFIGS) as GridMode[]) {
      expect(loaded[mode]).toEqual(EMPTY_STATS);
    }
  });

  test('resetStats clears every board', () => {
    const stats = emptyStatsByBoard();
    stats['9x9'] = { ...EMPTY_STATS, gamesPlayed: 9 };
    saveStats(stats);
    resetStats();
    expect(loadStats()['9x9']).toEqual(EMPTY_STATS);
  });
});
