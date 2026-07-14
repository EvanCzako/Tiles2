interface GameOverOverlayProps {
  score: number;
  highScore: number;
  onReset: () => void;
  onMenu?: () => void;
}

export default function GameOverOverlay({ score, highScore, onReset, onMenu }: GameOverOverlayProps) {
  const isNewBest = score > 0 && score >= highScore;

  return (
    <div className="game-over-overlay">
      <div className="game-over-box">
        <h2 className="game-over-title">GAME OVER</h2>

        <div className="game-over-stats">
          <div className="game-over-stat">
            <span className="game-over-stat-label">Score</span>
            <span className="game-over-stat-value">{score.toLocaleString()}</span>
          </div>
          <div className="game-over-stat">
            <span className="game-over-stat-label">Best</span>
            <span className="game-over-stat-value game-over-stat-value--best">
              {highScore.toLocaleString()}
            </span>
          </div>
        </div>

        {isNewBest && <p className="game-over-newbest">★ New Best ★</p>}

        <div className="game-over-buttons">
          <button className="menu-btn menu-btn--primary" onClick={onReset}>
            Play Again
          </button>
          {onMenu && (
            <button className="menu-btn menu-btn--secondary" onClick={onMenu}>
              Main Menu
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
