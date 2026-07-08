import useGameStore from '../store';
import Tile from './Tile';
import type { Screen } from '../types';

const DECO_TILES = [1, 2, 3, 4, 5, 6, 7];

interface MenuScreenProps {
  navigate: (screen: Screen) => void;
}

export default function MenuScreen({ navigate }: MenuScreenProps) {
  const highScore = useGameStore((s) => s.highScore);

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
        <button className="menu-btn menu-btn--primary" onClick={() => navigate('game')}>
          Play
        </button>
        <button className="menu-btn menu-btn--secondary" onClick={() => navigate('howToPlay')}>
          How to Play
        </button>
        <button className="menu-btn menu-btn--secondary" onClick={() => navigate('settings')}>
          Settings
        </button>
        {highScore > 0 && <p className="menu-best">Best: {highScore.toLocaleString()}</p>}
      </div>
    </div>
  );
}
