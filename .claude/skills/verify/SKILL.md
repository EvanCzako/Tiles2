---
name: verify
description: Build, launch, and drive UNTILED in a headless browser to verify gameplay changes end-to-end.
---

# Verifying UNTILED changes

## Launch

```bash
npm run dev   # Vite; picks the next free port if 5173 is busy — read the URL from output.
              # Base path is /Tiles2/ → e.g. http://localhost:5174/Tiles2/
```

## Drive (Playwright)

`npx playwright@1.61.1` works; install the library into the scratchpad
(`npm i playwright`) and run `npx playwright install chromium --only-shell`
if the cached browser build doesn't match.

Recipe that works:
- `page.click('text=Play')` from the menu, then wait for `.combo-strip`.
- Pushes: `page.keyboard.press('ArrowLeft'|'ArrowRight'|'ArrowUp'|'ArrowDown')`.
  Wait ~1400 ms between pushes — inputs during animation are silently dropped
  (store guard on `animating`), so rapid-fire just no-ops.
- Game over: watch for `Play Again` text, click it to restart.
- Useful selectors: `.score`, `.nuke-btn`, `.reroll-btn`, `.pending-row` /
  `.pending-col` (strips, first `.pending-row` = top), `.combo-strip-badge`,
  `.grid-cell .tile`.
- Transient juice elements (`.score-popup`, `.announcement`) live under 1 s —
  install a MutationObserver via `page.evaluate` at the start and record
  sightings on `window`, don't poll.
- The Zustand store is exposed as `window.__untiledStore` (getState/setState) —
  use it to engineer rare states (e.g. set `grid` + a pending strip, then push,
  to force a clean sweep) and to read `score`/`nukeCharge`/`animating` directly.
  Poll `animating === false` to know a turn fully settled.

## Flows worth driving

- Push in each direction → tiles fly in, cascades run, score popups appear.
- Charge the nuke by matching (~10–15 random pushes), button flips to `☢ NUKE`,
  fire with Space or click → `NUKE!` announcement + cross flash + charge resets.
- Reroll: click `↻ SWAP` → strips get `.pending--armed`, click a strip →
  values change, button shows `↻ 10` countdown.
- Capture `pageerror` and console errors — should be none.
