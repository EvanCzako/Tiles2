interface GameOverOverlayProps {
  score: number;
  highScore: number;
  onReset: () => void;
  onMenu?: () => void;
}

export default function GameOverOverlay({ score, highScore, onReset, onMenu }: GameOverOverlayProps) {
  return (
    <div className="game-over-overlay">
      <div className="game-over-box">
        <h2>GAME OVER</h2>
        <p>Score: {score}</p>
        <p>High Score: {highScore}</p>
        <button onClick={onReset}>Play Again</button>
        {onMenu && <button className="game-over-menu-btn" onClick={onMenu}>Main Menu</button>}
      </div>
    </div>
  );
}
