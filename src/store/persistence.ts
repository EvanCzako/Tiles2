const LS_KEY = 'tilesHighScores';

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
