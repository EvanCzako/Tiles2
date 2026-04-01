const isTouch = typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0);

export default function GameHeader({ score, highScore, onResetHighScore }) {
  return (
    <div className="game-header">
      <h1 className="title">TILES</h1>
      <div className="score-row">
        <p className="score">Score: {score}</p>
        <p className="high-score">High Score: {highScore}</p>
        <button className="reset-hs-btn" onClick={onResetHighScore} title="Reset high score">↻</button>
      </div>
      <p className="hint">
        {isTouch
          ? 'swipe ← → to push  ·  swipe ↓ to drop'
          : '← → push tiles in  ·  ↓ drop from top'}
      </p>
    </div>
  );
}
