import type { PaletteId, GridMode } from '../types';
import { PALETTE_IDS, GRID_CONFIGS } from '../game';

const SCORES_KEY = 'tilesHighScores';
const PALETTE_KEY = 'tilesColorPalette';
const SOUND_KEY = 'tilesSoundOn';
const GRID_MODE_KEY = 'tilesGridMode';

// localStorage is not always usable: Safari private browsing, "block all cookies",
// embedded webviews and storage-quota exhaustion all make getItem/setItem *throw*
// rather than return null. These run on the game-over path (saveHighScore) and at
// module scope (loadSoundOn in store/index.ts), so an unguarded throw would take
// the whole app down. Persistence is a nice-to-have — degrade to in-memory instead.
function readItem(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeItem(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable or full — the session still plays, it just won't persist */
  }
}

export function loadHighScores(): Record<string, number> {
  const saved = readItem(SCORES_KEY);
  if (!saved) return {};
  try {
    const parsed = JSON.parse(saved) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function loadHighScore(mode: GridMode): number {
  const score = loadHighScores()[mode];
  return typeof score === 'number' && Number.isFinite(score) ? score : 0;
}

export function saveHighScore(mode: GridMode, score: number): void {
  const scores = loadHighScores();
  scores[mode] = score;
  writeItem(SCORES_KEY, JSON.stringify(scores));
}

export function loadGridMode(): GridMode {
  const saved = readItem(GRID_MODE_KEY);
  return saved && saved in GRID_CONFIGS ? (saved as GridMode) : '9x9';
}

export function saveGridMode(mode: GridMode): void {
  writeItem(GRID_MODE_KEY, mode);
}

export function loadColorPalette(): PaletteId {
  const saved = readItem(PALETTE_KEY) as PaletteId | null;
  return saved && PALETTE_IDS.includes(saved) ? saved : 'default';
}

export function saveColorPalette(id: PaletteId): void {
  writeItem(PALETTE_KEY, id);
}

export function loadSoundOn(): boolean {
  return readItem(SOUND_KEY) !== 'false';
}

export function saveSoundOn(on: boolean): void {
  writeItem(SOUND_KEY, String(on));
}
