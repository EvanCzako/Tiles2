import type { PaletteId } from '../types';

const LS_KEY = 'tilesHighScores';
const PALETTE_KEY = 'tilesColorPalette';
const VALID_PALETTES: PaletteId[] = ['default', 'deuteranopia', 'protanopia', 'tritanopia', 'monochrome'];

export function loadHighScores(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const saved = localStorage.getItem(LS_KEY);
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
  localStorage.setItem(LS_KEY, JSON.stringify(scores));
}

export function loadColorPalette(): PaletteId {
  if (typeof window === 'undefined') return 'default';
  const saved = localStorage.getItem(PALETTE_KEY) as PaletteId | null;
  return saved && VALID_PALETTES.includes(saved) ? saved : 'default';
}

export function saveColorPalette(id: PaletteId): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PALETTE_KEY, id);
}
