import type { Screen } from '../types';

interface MenuScreenProps {
  navigate: (screen: Screen) => void;
}

export default function MenuScreen({ navigate }: MenuScreenProps) {
  return (
    <div className="menu-screen">
      <div className="menu-title-section">
        <h1 className="menu-title">UNTILED</h1>
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
      </div>
    </div>
  );
}
