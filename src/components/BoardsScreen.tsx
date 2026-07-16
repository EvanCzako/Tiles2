import { useShallow } from 'zustand/react/shallow';
import useGameStore from '../store';
import { loadHighScores } from '../store/persistence';
import type { Screen, GridMode } from '../types';

interface BoardInfo {
  mode: GridMode;
  label: string;
  blurb: string;
}

// Ordered small → large. The pending strip length is 3 / 5 / 7 respectively.
const BOARDS: BoardInfo[] = [
  { mode: '7x7', label: '7 × 7', blurb: 'Compact — 3-tile strips' },
  { mode: '9x9', label: '9 × 9', blurb: 'Standard — 5-tile strips' },
  { mode: '11x11', label: '11 × 11', blurb: 'Large — 7-tile strips' },
];

interface BoardsScreenProps {
  navigate: (screen: Screen) => void;
}

export default function BoardsScreen({ navigate }: BoardsScreenProps) {
  const { gridMode, setGridMode } = useGameStore(
    useShallow((s) => ({ gridMode: s.gridMode, setGridMode: s.setGridMode }))
  );
  const bestScores = loadHighScores();

  const play = (mode: GridMode) => {
    setGridMode(mode);
    navigate('game');
  };

  return (
    <div className="settings-screen">
      <div className="screen-header">
        <button className="screen-back-btn" onClick={() => navigate('menu')}>← Back</button>
        <h2 className="screen-heading">Boards</h2>
      </div>
      <div className="settings-content">
        <p className="settings-sublabel boards-intro">
          Pick a board size to play. Best scores are tracked separately per board.
        </p>
        <div className="boards-list">
          {BOARDS.map((b) => {
            const best = bestScores[b.mode] ?? 0;
            return (
              <button
                key={b.mode}
                className={`board-btn${gridMode === b.mode ? ' active' : ''}`}
                onClick={() => play(b.mode)}
              >
                <span className="board-btn-text">
                  <span className="board-size">{b.label}</span>
                  <span className="board-blurb">{b.blurb}</span>
                </span>
                <span className="board-best">{best > 0 ? `Best ${best.toLocaleString()}` : 'New'}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
