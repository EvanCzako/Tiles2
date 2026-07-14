interface GameHeaderProps {
  score: number;
  highScore: number;
  onMenu?: () => void;
}

export default function GameHeader({ score, highScore, onMenu }: GameHeaderProps) {
  return (
    <div className="game-header">
      <h1 className="title" onClick={onMenu} style={onMenu ? { cursor: 'pointer' } : undefined}>
        UNTILED
      </h1>
      <div className="score-row">
        <p className="score">Score: {score}</p>
        <p className="high-score">Best: {highScore}</p>
      </div>
    </div>
  );
}
