const isTouch =
  typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

const COMBO_COLORS = ['#8888aa', '#ffcc00', '#ff8822', '#ff4422', '#dd1144'];

export default function GameHeader({ score, highScore, combo }) {
  const comboColor = COMBO_COLORS[Math.min(combo - 1, 4)];
  const hint = isTouch ? 'swipe any direction to push' : '← → ↑ ↓ to push tiles in';
  return (
    <div className="game-header">
      <h1 className="title">TILES</h1>
      <div className="score-row">
        <p className="score">Score: {score}</p>
        <p className="combo" style={{ opacity: combo > 1 ? 1 : 0.3, color: comboColor }}>
          {combo}x
        </p>
        <p className="high-score">Best: {highScore}</p>
      </div>
      <p className="hint">{hint}</p>
    </div>
  );
}
