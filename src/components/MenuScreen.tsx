import { useShallow } from 'zustand/react/shallow';
import useGameStore from '../store';
import Tile from './Tile';
import type { Screen } from '../types';

const DECO_TILES = [1, 2, 3, 4, 5, 6, 7];

interface MenuScreenProps {
  navigate: (screen: Screen) => void;
}

export default function MenuScreen({ navigate }: MenuScreenProps) {
  const { highScore, gridMode, hasSavedRun, turnCount, gameOver, resumeRun, reset } = useGameStore(
    useShallow((s) => ({
      highScore: s.highScore,
      gridMode: s.gridMode,
      hasSavedRun: s.hasSavedRun,
      turnCount: s.turnCount,
      gameOver: s.gameOver,
      resumeRun: s.resumeRun,
      reset: s.reset,
    }))
  );

  // Two ways to have a run worth continuing: one still live in memory (the
  // player tapped the title mid-game to look at Settings) or one persisted by
  // an earlier session. The live one takes precedence — reloading it from
  // storage would roll the player back to the last settled turn.
  const liveRun = turnCount > 0 && !gameOver;
  const canContinue = liveRun || hasSavedRun;

  const onContinue = () => {
    // resumeRun() leaves state untouched and returns false if the save turns out
    // to be unreadable, which lands the player on the fresh board that is
    // already loaded rather than stranding them on the menu.
    if (!liveRun) resumeRun();
    navigate('game');
  };

  // New Game must actually be new: reset() rebuilds the board *and* drops the
  // persisted run, so Continue can't resurrect what the player just left.
  const onPlay = () => {
    reset();
    navigate('game');
  };

  return (
    <div className="menu-screen">
      <div className="menu-title-section">
        <h1 className="menu-title">UNTILED</h1>
        <div className="menu-tile-row">
          {DECO_TILES.map((v, i) => (
            <div
              key={v}
              className="menu-tile"
              style={{ transform: `rotate(${(i % 2 === 0 ? -1 : 1) * (2 + (i % 3) * 3)}deg)` }}
            >
              <Tile value={v} size={30} />
            </div>
          ))}
        </div>
        <p className="menu-subtitle">a tile annihilation game</p>
      </div>
      <div className="menu-buttons">
        {canContinue && (
          <button className="menu-btn menu-btn--primary" onClick={onContinue}>
            Continue
          </button>
        )}
        <button
          className={`menu-btn ${canContinue ? 'menu-btn--secondary' : 'menu-btn--primary'}`}
          onClick={onPlay}
        >
          {canContinue ? 'New Game' : 'Play'}
        </button>
        <button className="menu-btn menu-btn--secondary" onClick={() => navigate('boards')}>
          Boards
        </button>
        <button className="menu-btn menu-btn--secondary" onClick={() => navigate('howToPlay')}>
          How to Play
        </button>
        <button className="menu-btn menu-btn--secondary" onClick={() => navigate('stats')}>
          Stats
        </button>
        <button className="menu-btn menu-btn--secondary" onClick={() => navigate('settings')}>
          Settings
        </button>
        {highScore > 0 && (
          <p className="menu-best">
            {gridMode.replace('x', ' × ')} Best: {highScore.toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
