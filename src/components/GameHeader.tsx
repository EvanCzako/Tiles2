const isTouch =
  typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

const COMBO_COLORS = ['#8888aa', '#ffcc00', '#ff8822', '#ff4422', '#dd1144'];

interface GameHeaderProps {
  score: number;
  highScore: number;
  combo: number;
  onMenu?: () => void;
}

export default function GameHeader({ score, highScore, combo, onMenu }: GameHeaderProps) {
  const comboColor = COMBO_COLORS[Math.min(combo - 1, 4)];
  const hint = isTouch ? 'swipe any direction to push' : '← → ↑ ↓ to push tiles in';
  return (
    <div className="game-header">
      <h1 className="title" onClick={onMenu} style={onMenu ? { cursor: 'pointer' } : undefined}>UNTILED</h1>
      <div className="score-row">
        <p className="score">Score: {score}</p>
        <p className="high-score">Best: {highScore}</p>
      </div>
      <p className="hint">{hint}</p>
      <p className="combo" style={{ opacity: combo > 1 ? 1 : 0.3, color: comboColor }}>
        {combo}x
      </p>
    </div>
  );
}
