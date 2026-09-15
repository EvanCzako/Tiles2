// Store-level regression tests for the async animation chains.
//
// These exercise the real setTimeout/rAF cascade, so they need a rAF shim (the
// jest environment is node) and they wait in real time — each cascade is a few
// hundred ms of ANIM_MS/FLASH_MS steps.
(globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame = (cb: () => void) =>
  setTimeout(cb, 0) as unknown as number;
(globalThis as { cancelAnimationFrame?: unknown }).cancelAnimationFrame = (id: number) =>
  clearTimeout(id);

import useGameStore from './index';
import type { GridMode } from '../types';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Long enough for a push animation plus a multi-wave cascade to fully unwind.
const CASCADE_MS = 3000;

function expectConsistent(mode: GridMode) {
  const s = useGameStore.getState();
  expect(s.gridMode).toBe(mode);
  expect(s.grid.length).toBe(s.cfg.ROWS);
  for (const row of s.grid) expect(row.length).toBe(s.cfg.COLS);
  expect(s.leftPending.length).toBe(s.cfg.PENDING_SIZE);
  expect(s.rightPending.length).toBe(s.cfg.PENDING_SIZE);
  expect(s.topPending.length).toBe(s.cfg.PENDING_SIZE);
  expect(s.bottomPending.length).toBe(s.cfg.PENDING_SIZE);
}

describe('run guard — abandoned animation chains', () => {
  // Switching boards mid-cascade used to let the old game's timers commit their
  // (differently sized) grid into the new one, so the next push threw on an
  // out-of-range row. Sample several points across the push + cascade timeline.
  test.each([120, 260, 900])(
    'switching boards %ims into a push leaves the new board consistent',
    async (delay) => {
      useGameStore.getState().setGridMode('9x9');
      useGameStore.getState().triggerPush('left');
      await sleep(delay);

      useGameStore.getState().setGridMode('11x11');
      await sleep(CASCADE_MS);

      expectConsistent('11x11');
      // A fresh board must be playable: the stale chain must not have left
      // `animating` or a half-finished flight behind, and the push must not throw.
      expect(useGameStore.getState().animating).toBe(false);
      expect(useGameStore.getState().turnCount).toBe(0);
      expect(() => useGameStore.getState().triggerPush('up')).not.toThrow();
      // Let that push's own chain drain so it can't bleed into the next case.
      await sleep(1500);
    },
    30000
  );

  test('reset mid-cascade restores a clean, playable board', async () => {
    useGameStore.getState().setGridMode('9x9');
    useGameStore.getState().triggerPush('right');
    await sleep(300);

    useGameStore.getState().reset();
    await sleep(CASCADE_MS);

    expectConsistent('9x9');
    const s = useGameStore.getState();
    expect(s.score).toBe(0);
    expect(s.combo).toBe(1);
    expect(s.turnCount).toBe(0);
    expect(s.animating).toBe(false);
    expect(s.flyingTiles).toHaveLength(0);
    expect(s.gameOver).toBe(false);
  }, 30000);
});
