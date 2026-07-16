import type { PaletteId, GridMode } from '../types';
import { PALETTE_IDS, GRID_CONFIGS } from '../game';

const SCORES_KEY = 'tilesHighScores';
const PALETTE_KEY = 'tilesColorPalette';
const SOUND_KEY = 'tilesSoundOn';
const GRID_MODE_KEY = 'tilesGridMode';

export function loadHighScores(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const saved = localStorage.getItem(SCORES_KEY);
    return saved ? (JSON.parse(saved) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function loadHighScore(mode: string): number {
  return loadHighScores()[mode] ?? 0;
}

export function saveHighScore(mode: string, score: number): void {
  if (typeof window === 'undefined') return;
  const scores = loadHighScores();
  scores[mode] = score;
  localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
}

export function loadGridMode(): GridMode {
  if (typeof window === 'undefined') return '9x9';
  const saved = localStorage.getItem(GRID_MODE_KEY);
  return saved && saved in GRID_CONFIGS ? (saved as GridMode) : '9x9';
}

export function saveGridMode(mode: GridMode): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(GRID_MODE_KEY, mode);
}

export function loadColorPalette(): PaletteId {
  if (typeof window === 'undefined') return 'default';
  const saved = localStorage.getItem(PALETTE_KEY) as PaletteId | null;
  return saved && PALETTE_IDS.includes(saved) ? saved : 'default';
}

export function saveColorPalette(id: PaletteId): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PALETTE_KEY, id);
}

export function loadSoundOn(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(SOUND_KEY) !== 'false';
}

export function saveSoundOn(on: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SOUND_KEY, String(on));
}
